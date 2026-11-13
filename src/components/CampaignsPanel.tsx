import { CAMPAIGN_TYPE_LABELS, CAMPAIGN_TYPES, type CampaignInfo, type CampaignType } from '../lib/campaigns'
import { formatMoney, formatNumber } from '../lib/format'

type Props = {
  campaigns: CampaignInfo[]
  types: Record<string, CampaignType>
  onChange: (name: string, type: CampaignType) => void
}

export function CampaignsPanel({ campaigns, types, onChange }: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <h2 className="font-semibold">Кампании</h2>
      <p className="mt-1 text-sm text-slate-500">
        Вид кампании определён по названию. Если неверно — поменяйте: от вида зависит, что считается мусором.
      </p>
      <ul className="mt-3 divide-y divide-slate-100">
        {campaigns.map((c) => (
          <li key={c.name} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium break-all text-slate-800">
                {c.name || 'Весь отчёт (в файле нет колонки кампании)'}
              </div>
              <div className="text-xs text-slate-500">
                запросов: {formatNumber(c.queries)} · расход: {formatMoney(c.cost)}
              </div>
            </div>
            <select
              value={types[c.name]}
              onChange={(e) => onChange(c.name, e.target.value as CampaignType)}
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {CAMPAIGN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CAMPAIGN_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </section>
  )
}
