import { describe, expect, it } from 'vitest'
import { detectCampaignType, listCampaigns } from './campaigns'

describe('detectCampaignType', () => {
  it.each([
    ['demo_mi_oniksol-nails_ru(all)_web_srch_yd_brnd_brnd_dm_cpc_UIDmxor6n', 'brand'],
    ['demo_mi_oniksol-nails_ru(all)_web_srch_yd_category_nbrnd_dm_cpc_UIDmxor6n', 'category'],
    ['demo_mi_oniksol-nails_ru(all)_web_srch_yd_cmpt_nbrnd_dm_cpc_UIDmxor6n', 'competitor'],
    ['demo_mi_oniksol-nails_ru(all)_ozon_srch_yd_kws_mixbrnd_dm_cpc_UIDmxor6n', 'general'],
    ['Бренд | Поиск | Москва', 'brand'],
    ['Конкуренты_поиск', 'competitor'],
    ['Категорийная РСЯ', 'category'],
    ['Диваны_Поиск_Мск', 'general'],
    ['', 'general'],
  ])('%s → %s', (name, type) => {
    expect(detectCampaignType(name)).toBe(type)
  })

  it('«brnd» внутри других слов (nbrnd, mixbrnd) — не брендовая', () => {
    expect(detectCampaignType('shop_nbrnd')).toBe('category')
    expect(detectCampaignType('shop_mixbrnd')).toBe('general')
  })
})

describe('listCampaigns', () => {
  it('считает запросы и расход по кампаниям', () => {
    const base = { group: '', impressions: 0, clicks: 0, conversions: 0, brandMention: '' }
    expect(
      listCampaigns([
        { ...base, query: 'a', campaign: 'A', cost: 10 },
        { ...base, query: 'b', campaign: 'B', cost: 5 },
        { ...base, query: 'c', campaign: 'A', cost: 1 },
      ]),
    ).toEqual([
      { name: 'A', queries: 2, cost: 11 },
      { name: 'B', queries: 1, cost: 5 },
    ])
  })
})
