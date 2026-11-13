import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { detectCampaignType, type CampaignType } from './campaigns'
import {
  classifyRows,
  createClassifier,
  DEFAULT_SETTINGS,
  type Available,
  type ClassifiedRow,
  type Settings,
} from './classifier'
import { aggregateRows, autoMapColumns, buildRows, type QueryRow } from './parser'
import { readReport } from './read'

const ALL: Available = { clicks: true, cost: true, conversions: true, brandMention: true }

function load(file: string): { rows: QueryRow[]; available: Available } {
  const bytes = new Uint8Array(readFileSync(resolve(__dirname, '../../samples', file)))
  const table = readReport(bytes, file)
  const mapping = autoMapColumns(table.headers)
  return {
    rows: aggregateRows(buildRows(table, mapping)),
    available: {
      clicks: mapping.clicks !== undefined,
      cost: mapping.cost !== undefined,
      conversions: mapping.conversions !== undefined,
      brandMention: mapping.brandMention !== undefined,
    },
  }
}

function run(file: string, settings: Partial<Settings>): ClassifiedRow[] {
  const { rows, available } = load(file)
  const types: Record<string, CampaignType> = {}
  for (const r of rows) types[r.campaign] = detectCampaignType(r.campaign)
  return classifyRows(rows, types, { ...DEFAULT_SETTINGS, ...settings }, available)
}

const byStatus = (rows: ClassifiedRow[], s: string) => rows.filter((r) => r.status === s).map((r) => r.query)
const redCost = (rows: ClassifiedRow[]) =>
  Math.round(rows.filter((r) => r.status === 'red').reduce((s, r) => s + r.cost, 0) * 100) / 100
const kinds = (rows: ClassifiedRow[], query: string, campaignPart = '') =>
  rows
    .find((r) => r.query === query && r.campaign.includes(campaignPart))!
    .reasons.map((x) => x.kind)
    .sort()

describe('samples/search_queries_sample.csv → EXPECTED.md', () => {
  const rows = run('search_queries_sample.csv', { otherCompetitors: ['hoff', 'икеа'], ownCities: ['москва'] })

  it('13 мусорных + «отзывы» = 🔴 14', () => {
    expect(byStatus(rows, 'red').sort()).toEqual(
      [
        'диван угловой бесплатно',
        'угловой диван своими руками',
        'диван угловой авито б/у',
        'вакансии сборщик мебели',
        'диван угловой казань',
        'что такое еврокнижка диван',
        'диван hoff угловой',
        'диван угловой чертеж схема',
        'диван угловой икеа',
        'обивка дивана курсы обучение',
        'диван раскладной фото',
        'диван угловой торрент модель 3d скачать',
        'диван угловой тюмень',
        'диван угловой отзывы',
      ].sort(),
    )
  })

  it('6 целевых 🟢, 🟡 нет', () => {
    expect(byStatus(rows, 'green').sort()).toEqual(
      [
        'купить диван угловой',
        'диван угловой с доставкой москва',
        'диван еврокнижка недорого',
        'диван для гостиной купить',
        'диван угловой серый 3 метра',
        'диван угловой цена',
      ].sort(),
    )
    expect(byStatus(rows, 'yellow')).toEqual([])
  })

  it('причины совпадают с EXPECTED.md', () => {
    const expected: Record<string, string> = {
      'диван угловой бесплатно': 'free',
      'угловой диван своими руками': 'diy',
      'диван угловой авито б/у': 'used',
      'вакансии сборщик мебели': 'jobs',
      'диван угловой казань': 'geo',
      'что такое еврокнижка диван': 'info',
      'диван hoff угловой': 'competitor',
      'диван угловой чертеж схема': 'diy',
      'диван угловой икеа': 'competitor',
      'обивка дивана курсы обучение': 'education',
      'диван раскладной фото': 'info',
      'диван угловой торрент модель 3d скачать': 'free',
      'диван угловой тюмень': 'geo',
      'диван угловой отзывы': 'info',
    }
    for (const [q, kind] of Object.entries(expected)) {
      expect(kinds(rows, q).filter((k) => !k.startsWith('metric')), q).toEqual([kind])
    }
  })

  it('бюджет на мусор: 6 725,40 ₽ без «отзывов»', () => {
    expect(redCost(rows) - 820).toBeCloseTo(6725.4, 2)
  })
})

describe('samples/campaign_types_sample.csv → EXPECTED_campaigns.md', () => {
  const rows = run('campaign_types_sample.csv', {
    brandWords: ['ониксол'],
    allowedCompetitors: ['микодерил'],
    otherCompetitors: ['фунгистоп'],
  })

  it('24 запроса после склейки: 🔴 14, 🟡 2, 🟢 8', () => {
    expect(rows).toHaveLength(24)
    expect(byStatus(rows, 'red')).toHaveLength(14)
    expect(byStatus(rows, 'yellow').sort()).toEqual(['лак для ногтей нейлмакс', 'средство от грибка ногтей'])
    expect(byStatus(rows, 'green')).toHaveLength(8)
  })

  it('бюджет на мусор 985 ₽ и по видам кампаний', () => {
    expect(redCost(rows)).toBe(985)
    const byType = (t: CampaignType) =>
      rows.filter((r) => r.status === 'red' && r.campaignType === t).reduce((s, r) => s + r.cost, 0)
    expect(byType('brand')).toBeCloseTo(340)
    expect(byType('category')).toBeCloseTo(455)
    expect(byType('competitor')).toBeCloseTo(110)
    expect(byType('general')).toBeCloseTo(80)
  })

  it('брендовая', () => {
    expect(kinds(rows, 'лосьон для ногтей', 'brnd_brnd')).toEqual(['metric-clicks', 'no-brand'])
    expect(kinds(rows, 'ониксол или микодерил', 'brnd')).toEqual(['competitor'])
    expect(kinds(rows, 'ониксол столички', 'brnd')).toEqual(['metric-clicks', 'stores'])
    expect(kinds(rows, 'ониксол отзывы', 'brnd')).toEqual(['info'])
  })

  it('категорийная', () => {
    expect(kinds(rows, 'ониксол лосьон для ногтей', 'category')).toEqual(['own-brand'])
    expect(kinds(rows, 'фунгистоп для ногтей', 'category')).toEqual(['competitor', 'metric-clicks'])
    expect(kinds(rows, 'работа мастером маникюра', 'category')).toEqual(['jobs'])
    expect(kinds(rows, 'лак для ногтей нейлмакс', 'category')).toEqual(['metric-clicks', 'unknown-brand'])
    const glued = rows.find((r) => r.query === 'лосьон для ногтей от грибка')!
    expect(glued).toMatchObject({ status: 'green', cost: 1330, conversions: 7, group: 'Лосьон, Грибок' })
  })

  it('конкурентная', () => {
    expect(kinds(rows, 'микодерил лосьон', 'cmpt')).toEqual([])
    expect(kinds(rows, 'фунгистоп лосьон', 'cmpt')).toEqual(['competitor'])
    expect(kinds(rows, 'ониксол или микодерил что лучше', 'cmpt')).toEqual(['own-brand'])
    expect(kinds(rows, 'микодерил озон', 'cmpt')).toEqual(['stores'])
    expect(kinds(rows, 'микодерил аналоги', 'cmpt')).toEqual(['info'])
  })

  it('общая', () => {
    expect(kinds(rows, 'микодерил лосьон', 'mixbrnd')).toEqual([])
    expect(kinds(rows, 'ониксол лосьон для ногтей', 'mixbrnd')).toEqual([])
    expect(kinds(rows, 'фунгистоп купить', 'mixbrnd')).toEqual(['competitor'])
  })
})

describe('правила по отдельности', () => {
  const row = (query: string, extra: Partial<QueryRow> = {}): QueryRow => ({
    query,
    campaign: '',
    group: '',
    impressions: 0,
    clicks: 0,
    cost: 0,
    conversions: 0,
    brandMention: '',
    ...extra,
  })
  const make = (s: Partial<Settings>, a: Available = ALL) => createClassifier({ ...DEFAULT_SETTINGS, ...s }, a)

  it('без слов бренда правила own-brand / no-brand молчат', () => {
    const c = make({})
    expect(c(row('лосьон для ногтей'), 'brand').status).toBe('green')
  })

  it('слова бренда ловят разные формы', () => {
    const c = make({ brandWords: ['ониксол', 'oniksol'] })
    expect(c(row('Oniksol лосьон'), 'category').status).toBe('red')
    expect(c(row('лосьон ониксол'), 'brand').status).toBe('green')
  })

  it('белый список понижает 🔴 до 🟡', () => {
    const c = make({ whitelist: ['отзывы'] })
    const r = c(row('диван отзывы'), 'general')
    expect(r.status).toBe('yellow')
    expect(r.reasons.map((x) => x.kind)).toEqual(['info', 'whitelist'])
  })

  it('выключенный словарь не срабатывает', () => {
    const c = make({ categories: { ...DEFAULT_SETTINGS.categories, used: false, stores: false } })
    expect(c(row('диван б/у'), 'general').status).toBe('green')
    expect(c(row('лосьон столички'), 'general').status).toBe('green')
  })

  it('дополнительные магазины работают даже при выключенном словаре', () => {
    const c = make({ extraStores: ['моя аптека'], categories: { ...DEFAULT_SETTINGS.categories, stores: false } })
    expect(c(row('лосьон моя аптека'), 'general').reasons[0].kind).toBe('stores')
  })

  it('гео: без своего города выключено; свой город и его синонимы — не чужие', () => {
    expect(make({})(row('маникюр казань'), 'general').status).toBe('green')
    const spb = make({ ownCities: ['Санкт-Петербург'] })
    expect(spb(row('маникюр спб'), 'general').status).toBe('green')
    expect(spb(row('маникюр питер'), 'general').status).toBe('green')
    expect(spb(row('маникюр в москве'), 'general').reasons[0]).toMatchObject({ kind: 'geo', words: ['москве'] })
  })

  it('конкурент в обоих списках считается разрешённым', () => {
    const c = make({ allowedCompetitors: ['микодерил'], otherCompetitors: ['микодерил'] })
    expect(c(row('микодерил'), 'competitor').status).toBe('green')
  })

  it('метрики: только если есть колонки и нет конверсий', () => {
    const r = row('лосьон', { clicks: 10, cost: 600 })
    expect(make({})(r, 'general').reasons.map((x) => x.kind)).toEqual(['metric-clicks', 'metric-cost'])
    expect(make({})({ ...r, conversions: 1 }, 'general').status).toBe('green')
    const noConv: Available = { ...ALL, conversions: false }
    expect(make({}, noConv)(r, 'general').status).toBe('green')
  })

  it('unknown-brand только если колонка есть', () => {
    const r = row('лак нейлмакс', { brandMention: 'Запросы с упоминанием брендов конкурентов' })
    expect(make({})(r, 'general').status).toBe('yellow')
    expect(make({}, { ...ALL, brandMention: false })(r, 'general').status).toBe('green')
  })

  it('слова в причине — как в запросе', () => {
    const r = make({})(row('скачать бесплатные курсы'), 'general')
    expect(r.reasons).toEqual([
      { kind: 'free', severity: 'red', words: ['скачать', 'бесплатные'], phrases: ['скачать', 'бесплатно'] },
      { kind: 'education', severity: 'red', words: ['курсы'], phrases: ['курсы'] },
    ])
  })
})
