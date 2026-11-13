import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { detectCampaignType, type CampaignType } from './campaigns'
import { classifyRows, DEFAULT_SETTINGS, type Settings } from './classifier'
import { aggregateRows, autoMapColumns, buildRows } from './parser'
import { readReport } from './read'
import { computeSummary, formatShare } from './summary'

function run(file: string, s: Partial<Settings>) {
  const bytes = new Uint8Array(readFileSync(resolve(__dirname, '../../samples', file)))
  const table = readReport(bytes, file)
  const mapping = autoMapColumns(table.headers)
  const rows = aggregateRows(buildRows(table, mapping))
  const types: Record<string, CampaignType> = {}
  for (const r of rows) types[r.campaign] = detectCampaignType(r.campaign)
  const available = { clicks: true, cost: true, conversions: true, brandMention: mapping.brandMention !== undefined }
  return classifyRows(rows, types, { ...DEFAULT_SETTINGS, ...s }, available)
}

describe('сводка по samples/search_queries_sample.csv', () => {
  const s = computeSummary(run('search_queries_sample.csv', { otherCompetitors: ['hoff', 'икеа'], ownCities: ['москва'] }))

  it('бюджет на мусор 6 725,40 ₽ — как в EXPECTED.md («отзывы» с конверсией отдельно)', () => {
    expect(s.waste).toEqual({ queries: 13, cost: 6725.4 })
    expect(s.redWithConversions).toEqual({ queries: 1, cost: 820 })
    expect(s.total).toEqual({ queries: 20, cost: 21875.9 })
    expect(formatShare(s.wasteShare)).toBe('30,7 %')
  })
})

describe('сводка по samples/campaign_types_sample.csv', () => {
  const s = computeSummary(
    run('campaign_types_sample.csv', {
      brandWords: ['ониксол'],
      allowedCompetitors: ['микодерил'],
      otherCompetitors: ['фунгистоп'],
    }),
  )

  it('главная цифра и мусор с конверсиями', () => {
    expect(s.waste).toEqual({ queries: 12, cost: 745 })
    expect(s.redWithConversions).toEqual({ queries: 2, cost: 240 })
    expect(s.yellow).toEqual({ queries: 2, cost: 790 })
  })

  it('по видам кампаний', () => {
    expect(s.byType.map((t) => [t.type, t.waste.cost, t.total.cost])).toEqual([
      ['brand', 300, 1340],
      ['category', 255, 3375],
      ['competitor', 110, 410],
      ['general', 80, 960],
    ])
  })
})

describe('formatShare', () => {
  it.each([
    [0, '0 %'],
    [0.3446, '34,5 %'],
    [0.5, '50 %'],
    [0.0004, '<0,1 %'],
  ])('%d → %s', (v, t) => expect(formatShare(v)).toBe(t))
})

describe('пустой отчёт', () => {
  it('без деления на ноль', () => {
    const s = computeSummary([])
    expect(s.wasteShare).toBe(0)
    expect(s.byType).toEqual([])
  })
})
