import { CAMPAIGN_TYPE_LABELS } from '../lib/campaigns'
import { formatMoney, formatNumber } from '../lib/format'
import { formatShare, type Summary } from '../lib/summary'

type Props = {
  summary: Summary
  hasCost: boolean
}

export function SummaryPanel({ summary: s, hasCost }: Props) {
  if (!hasCost) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h2 className="font-semibold">Сводка</h2>
        <p className="mt-2 text-sm text-slate-600">
          Мусорных запросов: <b>{formatNumber(s.waste.queries + s.redWithConversions.queries)}</b> из{' '}
          {formatNumber(s.total.queries)}. В отчёте нет колонки с расходом — посчитать, сколько денег ушло на мусор,
          не получится.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white px-5 py-5 sm:px-7">
      <div className="text-sm font-medium text-rose-700">Ушло на мусор</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <div className="text-4xl font-bold tracking-tight text-slate-900 tabular-nums sm:text-5xl">
          {formatMoney(s.waste.cost)}
        </div>
        <div className="text-lg text-slate-600">
          {formatShare(s.wasteShare)} от расхода {formatMoney(s.total.cost)}
        </div>
      </div>
      <div className="mt-1 text-sm text-slate-500">
        {formatNumber(s.waste.queries)} мусорных запросов без единой конверсии из {formatNumber(s.total.queries)}
      </div>

      {s.byType.length > 1 && (
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {s.byType.map((t) => (
            <div key={t.type} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div className="text-sm text-slate-500">{CAMPAIGN_TYPE_LABELS[t.type]}</div>
              <div className="mt-0.5 text-xl font-semibold text-slate-900 tabular-nums">{formatMoney(t.waste.cost)}</div>
              <div className="text-xs text-slate-500">
                {formatShare(t.total.cost > 0 ? t.waste.cost / t.total.cost : 0)} от {formatMoney(t.total.cost)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-1 text-sm text-slate-600">
        {s.redWithConversions.queries > 0 && (
          <div>
            🔴 Ещё <b>{formatMoney(s.redWithConversions.cost)}</b> — мусорные по правилам запросы, у которых были
            конверсии ({formatNumber(s.redWithConversions.queries)} шт.). В главную цифру не входят — проверьте их
            вручную.
          </div>
        )}
        {s.yellow.queries > 0 && (
          <div>
            🟡 <b>{formatMoney(s.yellow.cost)}</b> — спорные запросы ({formatNumber(s.yellow.queries)} шт.).
          </div>
        )}
      </div>
    </section>
  )
}
