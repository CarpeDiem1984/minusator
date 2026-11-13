import type { QueryRow } from './parser'

export type CampaignType = 'brand' | 'category' | 'competitor' | 'general'

export const CAMPAIGN_TYPES: CampaignType[] = ['brand', 'category', 'competitor', 'general']

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  brand: 'Брендовая',
  category: 'Категорийная',
  competitor: 'Конкурентная',
  general: 'Общая',
}

/**
 * Угадывает вид кампании по названию. Название режется на части по «_», «-», пробелам и т. п.
 * Это частая практика именования, а не жёсткое правило, поэтому вид можно поменять вручную.
 *
 *   …_brnd_brnd_…       → брендовая
 *   …_category_nbrnd_…  → категорийная
 *   …_cmpt_nbrnd_…      → конкурентная
 *   …_kws_mixbrnd_…     → общая
 */
export function detectCampaignType(name: string): CampaignType {
  const lower = name.toLowerCase().replace(/ё/g, 'е')
  const parts = lower.split(/[^a-zа-я0-9]+/).filter(Boolean)
  const has = (...words: string[]) => parts.some((p) => words.includes(p))
  const startsWith = (...prefixes: string[]) => parts.some((p) => prefixes.some((x) => p.startsWith(x)))

  if (has('cmpt', 'comp', 'compet', 'competitor', 'competitors', 'konk', 'konkurent') || startsWith('конкурент'))
    return 'competitor'
  if (startsWith('mix', 'микс')) return 'general'
  if (has('category', 'cat', 'ctg', 'categ', 'nbrnd', 'nobrand', 'nonbrand', 'kat') || startsWith('категор', 'небренд'))
    return 'category'
  if (has('brnd', 'brand', 'brend') || startsWith('бренд')) return 'brand'
  return 'general'
}

export type CampaignInfo = {
  name: string
  queries: number
  cost: number
}

/** Список кампаний из отчёта (по первому появлению). Без колонки кампании — одна кампания ''. */
export function listCampaigns(rows: QueryRow[]): CampaignInfo[] {
  const map = new Map<string, CampaignInfo>()
  for (const r of rows) {
    const c = map.get(r.campaign)
    if (c) {
      c.queries++
      c.cost += r.cost
    } else {
      map.set(r.campaign, { name: r.campaign, queries: 1, cost: r.cost })
    }
  }
  return [...map.values()]
}
