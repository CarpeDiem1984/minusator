import { useState } from 'react'
import { formatMoney, formatNumber } from '../lib/format'
import type { ColumnMapping, QueryRow } from '../lib/parser'

type Props = {
  rows: QueryRow[]
  mapping: ColumnMapping
}

const PAGE = 200

export function QueriesTable({ rows, mapping }: Props) {
  const [limit, setLimit] = useState(PAGE)
  const has = (f: keyof ColumnMapping) => mapping[f] !== undefined
  const visible = rows.slice(0, limit)

  const th = 'px-3 py-2 text-left font-medium text-slate-600 whitespace-nowrap'
  const thNum = 'px-3 py-2 text-right font-medium text-slate-600 whitespace-nowrap'
  const td = 'px-3 py-2 align-top'
  const tdNum = 'px-3 py-2 text-right tabular-nums whitespace-nowrap align-top'

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className={th}>Запрос</th>
              {has('campaign') && <th className={th}>Кампания</th>}
              {has('group') && <th className={th}>Группа</th>}
              {has('impressions') && <th className={thNum}>Показы</th>}
              {has('clicks') && <th className={thNum}>Клики</th>}
              {has('cost') && <th className={thNum}>Расход</th>}
              {has('conversions') && <th className={thNum}>Конв.</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className={`${td} min-w-48 text-slate-900`}>{r.query}</td>
                {has('campaign') && <td className={`${td} text-slate-500`}>{r.campaign}</td>}
                {has('group') && <td className={`${td} text-slate-500`}>{r.group}</td>}
                {has('impressions') && <td className={tdNum}>{formatNumber(r.impressions)}</td>}
                {has('clicks') && <td className={tdNum}>{formatNumber(r.clicks)}</td>}
                {has('cost') && <td className={tdNum}>{formatMoney(r.cost)}</td>}
                {has('conversions') && <td className={tdNum}>{formatNumber(r.conversions)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Показать ещё (осталось {formatNumber(rows.length - limit)})
          </button>
        </div>
      )}
    </div>
  )
}
