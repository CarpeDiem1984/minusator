import { CAMPAIGN_TYPES, type CampaignType } from './campaigns'
import type { ClassifiedRow } from './classifier'

export type Bucket = { queries: number; cost: number }

export type TypeSummary = {
  type: CampaignType
  total: Bucket
  /** Мусор без конверсий — главная цифра. */
  waste: Bucket
}

export type Summary = {
  total: Bucket
  /** 🔴 без конверсий: «сколько бюджета ушло на мусор». */
  waste: Bucket
  /** 🔴, но с конверсиями — в главную цифру не входят, человек решает сам. */
  redWithConversions: Bucket
  yellow: Bucket
  green: Bucket
  /** Доля мусора в общем расходе, 0..1. */
  wasteShare: number
  /** По видам кампаний, которые есть в отчёте. */
  byType: TypeSummary[]
}

const empty = (): Bucket => ({ queries: 0, cost: 0 })
const add = (b: Bucket, cost: number) => {
  b.queries++
  b.cost += cost
}
const round = (b: Bucket): Bucket => ({ queries: b.queries, cost: Math.round(b.cost * 100) / 100 })

export function computeSummary(rows: ClassifiedRow[]): Summary {
  const total = empty()
  const waste = empty()
  const redWithConversions = empty()
  const yellow = empty()
  const green = empty()
  const byType = new Map<CampaignType, { total: Bucket; waste: Bucket }>()

  for (const r of rows) {
    add(total, r.cost)
    let t = byType.get(r.campaignType)
    if (!t) {
      t = { total: empty(), waste: empty() }
      byType.set(r.campaignType, t)
    }
    add(t.total, r.cost)

    if (r.status === 'red') {
      if (r.conversions > 0) add(redWithConversions, r.cost)
      else {
        add(waste, r.cost)
        add(t.waste, r.cost)
      }
    } else if (r.status === 'yellow') add(yellow, r.cost)
    else add(green, r.cost)
  }

  return {
    total: round(total),
    waste: round(waste),
    redWithConversions: round(redWithConversions),
    yellow: round(yellow),
    green: round(green),
    wasteShare: total.cost > 0 ? waste.cost / total.cost : 0,
    byType: CAMPAIGN_TYPES.filter((t) => byType.has(t)).map((type) => ({
      type,
      total: round(byType.get(type)!.total),
      waste: round(byType.get(type)!.waste),
    })),
  }
}

/** 0.3446 → «34,5 %» */
export function formatShare(share: number): string {
  const pct = share * 100
  const text = pct > 0 && pct < 0.1 ? '<0,1' : pct.toFixed(1).replace('.', ',').replace(/,0$/, '')
  return `${text} %`
}
