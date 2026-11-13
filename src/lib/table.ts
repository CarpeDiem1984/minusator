import type { CampaignType } from './campaigns'
import type { ClassifiedRow, ReasonKind, Status } from './classifier'
import { normalize } from './text'

export type Filters = {
  status: Status | 'all'
  campaignType: CampaignType | 'all'
  reason: ReasonKind | 'all'
  search: string
}

export const DEFAULT_FILTERS: Filters = { status: 'all', campaignType: 'all', reason: 'all', search: '' }

export type SortKey = 'status' | 'query' | 'impressions' | 'clicks' | 'cost' | 'conversions'
export type Sort = { key: SortKey; dir: 'asc' | 'desc' }

export const DEFAULT_SORT: Sort = { key: 'cost', dir: 'desc' }

const STATUS_ORDER: Record<Status, number> = { red: 0, yellow: 1, green: 2 }

export function filterRows(rows: ClassifiedRow[], f: Filters): ClassifiedRow[] {
  const search = normalize(f.search)
  return rows.filter(
    (r) =>
      (f.status === 'all' || r.status === f.status) &&
      (f.campaignType === 'all' || r.campaignType === f.campaignType) &&
      (f.reason === 'all' || r.reasons.some((x) => x.kind === f.reason)) &&
      (!search || normalize(r.query).includes(search)),
  )
}

export function sortRows(rows: ClassifiedRow[], s: Sort): ClassifiedRow[] {
  const sign = s.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    let d: number
    if (s.key === 'status') d = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    else if (s.key === 'query') d = a.query.localeCompare(b.query, 'ru')
    else d = a[s.key] - b[s.key]
    // при равенстве — по расходу, чтобы дорогие были выше
    return d !== 0 ? d * sign : b.cost - a.cost
  })
}

export type Counts = Record<Status | 'all', number>

export function countByStatus(rows: ClassifiedRow[]): Counts {
  const c: Counts = { all: rows.length, red: 0, yellow: 0, green: 0 }
  for (const r of rows) c[r.status]++
  return c
}
