import { useDeferredValue, useMemo, useState } from 'react'
import { CAMPAIGN_TYPE_LABELS, CAMPAIGN_TYPES } from '../lib/campaigns'
import { describeReason, REASON_LABELS, type ClassifiedRow, type ReasonKind, type Status } from '../lib/classifier'
import { formatMoney, formatNumber } from '../lib/format'
import type { ColumnMapping } from '../lib/parser'
import { countByStatus, filterRows, sortRows, type Filters, type Sort, type SortKey } from '../lib/table'

type Props = {
  rows: ClassifiedRow[]
  mapping: ColumnMapping
  filters: Filters
  onFiltersChange: (f: Filters) => void
}

const PAGE = 200

const STATUS_ICON: Record<Status, string> = { red: '🔴', yellow: '🟡', green: '🟢' }
const STATUS_TABS: { key: Status | 'all'; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'red', label: '🔴 Мусор' },
  { key: 'yellow', label: '🟡 Спорные' },
  { key: 'green', label: '🟢 Целевые' },
]

export function QueriesTable({ rows, mapping, filters, onFiltersChange }: Props) {
  const [limit, setLimit] = useState(PAGE)
  const [sort, setSort] = useState<Sort>({ key: 'cost', dir: 'desc' })
  const has = (f: keyof ColumnMapping) => mapping[f] !== undefined
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setLimit(PAGE)
    onFiltersChange({ ...filters, [key]: value })
  }

  // поля фильтров обновляются сразу, а тяжёлый пересчёт таблицы — чуть позже
  const applied = useDeferredValue(filters)
  // счётчики статусов — с учётом остальных фильтров, но без фильтра по статусу
  const counts = useMemo(() => countByStatus(filterRows(rows, { ...applied, status: 'all' })), [rows, applied])
  const reasonsPresent = useMemo(() => {
    const s = new Set<ReasonKind>()
    for (const r of rows) for (const x of r.reasons) s.add(x.kind)
    return (Object.keys(REASON_LABELS) as ReasonKind[]).filter((k) => s.has(k))
  }, [rows])
  const typesPresent = useMemo(() => CAMPAIGN_TYPES.filter((t) => rows.some((r) => r.campaignType === t)), [rows])
  const visible = useMemo(() => sortRows(filterRows(rows, applied), sort), [rows, applied, sort])

  function sortBy(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'query' || key === 'status' ? 'asc' : 'desc' }))
  }

  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '')
  const th = 'px-3 py-2 text-left font-medium text-slate-600 whitespace-nowrap'
  const thNum = 'px-3 py-2 text-right font-medium text-slate-600 whitespace-nowrap'
  const sortable = 'cursor-pointer select-none hover:text-slate-900'
  const td = 'px-3 py-2 align-top'
  const tdNum = 'px-3 py-2 text-right tabular-nums whitespace-nowrap align-top'

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => set('status', t.key)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              filters.status === t.key
                ? 'border-slate-800 bg-slate-800 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {t.label} <span className="opacity-70">{formatNumber(counts[t.key])}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
          placeholder="Поиск по запросам"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
        />
        <select
          value={filters.campaignType}
          onChange={(e) => set('campaignType', e.target.value as Filters['campaignType'])}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
        >
          <option value="all">Все виды кампаний</option>
          {typesPresent.map((t) => (
            <option key={t} value={t}>
              {CAMPAIGN_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={filters.reason}
          onChange={(e) => set('reason', e.target.value as Filters['reason'])}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
        >
          <option value="all">Все причины</option>
          {reasonsPresent.map((k) => (
            <option key={k} value={k}>
              {REASON_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className={`${th} ${sortable}`} onClick={() => sortBy('status')} title="Статус">
                Ст.{arrow('status')}
              </th>
              <th className={`${th} ${sortable}`} onClick={() => sortBy('query')}>
                Запрос{arrow('query')}
              </th>
              <th className={th}>Причина</th>
              <th className={th}>Кампания</th>
              {has('impressions') && (
                <th className={`${thNum} ${sortable}`} onClick={() => sortBy('impressions')}>
                  Показы{arrow('impressions')}
                </th>
              )}
              {has('clicks') && (
                <th className={`${thNum} ${sortable}`} onClick={() => sortBy('clicks')}>
                  Клики{arrow('clicks')}
                </th>
              )}
              {has('cost') && (
                <th className={`${thNum} ${sortable}`} onClick={() => sortBy('cost')}>
                  Расход{arrow('cost')}
                </th>
              )}
              {has('conversions') && (
                <th className={`${thNum} ${sortable}`} onClick={() => sortBy('conversions')}>
                  Конв.{arrow('conversions')}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.slice(0, limit).map((r) => (
              <tr key={`${r.campaign}\u0000${r.query}`} className="hover:bg-slate-50">
                <td className={`${td} text-center`}>{STATUS_ICON[r.status]}</td>
                <td className={`${td} min-w-48 text-slate-900`}>
                  {r.query}
                  {r.group && <div className="text-xs text-slate-400">{r.group}</div>}
                </td>
                <td className={`${td} min-w-40 text-slate-600`}>
                  {r.reasons.map((x, i) => (
                    <div key={i} className={x.severity === 'red' ? 'text-rose-700' : x.severity === 'yellow' ? 'text-amber-700' : 'text-slate-500'}>
                      {describeReason(x)}
                    </div>
                  ))}
                </td>
                <td className={`${td} whitespace-nowrap text-slate-500`} title={r.campaign}>
                  {CAMPAIGN_TYPE_LABELS[r.campaignType]}
                </td>
                {has('impressions') && <td className={tdNum}>{formatNumber(r.impressions)}</td>}
                {has('clicks') && <td className={tdNum}>{formatNumber(r.clicks)}</td>}
                {has('cost') && <td className={tdNum}>{formatMoney(r.cost)}</td>}
                {has('conversions') && (
                  <td
                    className={`${tdNum} ${r.status !== 'green' && r.conversions > 0 ? 'font-semibold text-emerald-700' : ''}`}
                    title={r.status !== 'green' && r.conversions > 0 ? 'У запроса были конверсии — проверьте, точно ли это мусор' : undefined}
                  >
                    {formatNumber(r.conversions)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-500">Ничего не нашлось</p>}
      </div>

      {visible.length > limit && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Показать ещё (осталось {formatNumber(visible.length - limit)})
          </button>
        </div>
      )}
    </section>
  )
}
