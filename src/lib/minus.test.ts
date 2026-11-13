import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { detectCampaignType, type CampaignType } from './campaigns'
import { classifyRows, DEFAULT_SETTINGS, type ClassifiedRow, type Settings } from './classifier'
import {
  brandSuggestions,
  dedupeWords,
  formatMinusWords,
  frequencyCandidates,
  ruleCandidates,
  ruleExcludeKeys,
  stemKey,
} from './minus'
import { aggregateRows, autoMapColumns, buildRows, readReport } from './parser'

function run(file: string, s: Partial<Settings>): { rows: ClassifiedRow[]; settings: Settings } {
  const bytes = new Uint8Array(readFileSync(resolve(__dirname, '../../samples', file)))
  const table = readReport(bytes, file)
  const mapping = autoMapColumns(table.headers)
  const rows = aggregateRows(buildRows(table, mapping))
  const types: Record<string, CampaignType> = {}
  for (const r of rows) types[r.campaign] = detectCampaignType(r.campaign)
  const settings = { ...DEFAULT_SETTINGS, ...s }
  const available = {
    clicks: mapping.clicks !== undefined,
    cost: mapping.cost !== undefined,
    conversions: mapping.conversions !== undefined,
    brandMention: mapping.brandMention !== undefined,
  }
  return { rows: classifyRows(rows, types, settings, available), settings }
}

const demo = run('campaign_types_sample.csv', {
  brandWords: ['ониксол'],
  allowedCompetitors: ['микодерил'],
  otherCompetitors: ['фунгистоп'],
})
const words = (list: { word: string }[]) => list.map((c) => c.word)

describe('ruleCandidates — свой список на каждый вид кампании', () => {
  it('брендовая: конкурент (даже разрешённый), магазин, «отзывы»', () => {
    const c = ruleCandidates(demo.rows, 'brand', demo.settings)
    expect(words(c)).toEqual(['микодерил', 'столички', 'отзывы'])
    expect(c[0]).toMatchObject({ kinds: ['competitor'], queries: 1, cost: 80, source: 'rule' })
  })

  it('категорийная: наш бренд, чужой бренд, словари; сортировка по расходу', () => {
    expect(words(ruleCandidates(demo.rows, 'category', demo.settings))).toEqual([
      'ониксол',
      'фунгистоп',
      'своими руками',
      'работа',
    ])
  })

  it('конкурентная: разрешённого конкурента нет, наш бренд есть', () => {
    expect(words(ruleCandidates(demo.rows, 'competitor', demo.settings))).toEqual([
      'аналоги',
      'ониксол',
      'фунгистоп',
      'озон',
    ])
  })

  it('общая', () => {
    expect(words(ruleCandidates(demo.rows, 'general', demo.settings))).toEqual(['фунгистоп', 'бесплатно'])
  })

  it('одно слово в нескольких запросах — суммирует расход и запросы', () => {
    const r = run('campaign_types_sample.csv', {
      brandWords: ['ониксол'],
      allowedCompetitors: ['микодерил'],
      otherCompetitors: ['фунгистоп'],
    })
    // в категорийной «ониксол» — 1 запрос; добавим ещё один вручную
    const extra = { ...r.rows.find((x) => x.query === 'ониксол лосьон для ногтей' && x.campaignType === 'category')! }
    extra.query = 'ониксол крем'
    extra.cost = 50
    const c = ruleCandidates([...r.rows, extra], 'category', r.settings)
    expect(c[0]).toMatchObject({ word: 'ониксол', queries: 2, cost: 250 })
  })

  it('белый список и свой город не предлагаются', () => {
    const c = ruleCandidates(demo.rows, 'category', { ...demo.settings, whitelist: ['работа'] })
    expect(words(c)).not.toContain('работа')
  })
})

describe('samples/search_queries_sample.csv — минус-слова', () => {
  const { rows, settings } = run('search_queries_sample.csv', {
    otherCompetitors: ['hoff', 'икеа'],
    ownCities: ['москва'],
  })
  it('слово, а не весь запрос; без дублей форм', () => {
    const w = words(ruleCandidates(rows, 'general', settings))
    expect(w).toEqual(
      expect.arrayContaining([
        'бесплатно',
        'своими руками',
        'авито',
        'б/у',
        'вакансия',
        'казань',
        'что такое',
        'hoff',
        'икеа',
        'чертеж',
        'схема',
        'курсы',
        'обучение',
        'фото',
        'торрент',
        'скачать',
        'тюмень',
        'отзывы',
      ]),
    )
    expect(w).toHaveLength(18)
    expect(w[0]).toBe('hoff') // самый дорогой мусор — 1 340 ₽
  })
})

describe('frequencyCandidates', () => {
  it('брендовая: слова из запросов без бренда, которых нет в 🟢', () => {
    const exclude = ruleExcludeKeys(ruleCandidates(demo.rows, 'brand', demo.settings))
    const f = frequencyCandidates(demo.rows, 'brand', demo.settings, exclude)
    expect(words(f)).toEqual(['ногтей'])
    expect(f[0]).toMatchObject({ source: 'frequency', queries: 1, cost: 150 })
  })

  it('не предлагает служебные слова, числа, бренд в брендовой', () => {
    const f = frequencyCandidates(demo.rows, 'brand', demo.settings)
    const w = words(f)
    for (const bad of ['для', 'или', 'ониксол', 'лосьон']) expect(w).not.toContain(bad)
  })
})

describe('ruleExcludeKeys', () => {
  it('«составе» не дублирует «состав» (у них разные основы)', () => {
    const keys = ruleExcludeKeys([{ key: 'x', word: 'состав', kinds: [], queries: 1, cost: 0, source: 'rule' }])
    expect(keys.has('состав')).toBe(true) // основа слова «составе»
  })
})

describe('brandSuggestions', () => {
  it('находит неизвестный бренд по колонке Директа', () => {
    const s = brandSuggestions(demo.rows, demo.settings)
    expect(words(s)).toContain('нейлмакс')
    expect(s.find((x) => x.word === 'нейлмакс')).toMatchObject({ queries: 1, example: 'лак для ногтей нейлмакс' })
  })

  it('отмеченное как «не бренд» или «конкурент» больше не предлагается', () => {
    const s = brandSuggestions(demo.rows, { ...demo.settings, notBrands: ['лак'], otherCompetitors: ['нейлмакс'] })
    expect(words(s)).not.toContain('лак')
    expect(words(s)).not.toContain('нейлмакс')
  })
})

describe('formatMinusWords', () => {
  const list = ['бесплатно', 'Своими  руками', 'скачать']
  it('по одному в строке', () => {
    expect(formatMinusWords(list, 'lines', false)).toBe('бесплатно\nсвоими руками\nскачать')
  })
  it('через минус; фразы отдельными строками', () => {
    expect(formatMinusWords(list, 'minus', false)).toBe('-бесплатно -скачать\nсвоими руками')
  })
  it('фиксация формы', () => {
    expect(formatMinusWords(list, 'minus', true)).toBe('-!бесплатно -!скачать\n!своими !руками')
    expect(formatMinusWords(['!уже'], 'lines', true)).toBe('!уже')
  })
  it('пустой список', () => {
    expect(formatMinusWords([], 'minus', false)).toBe('')
  })
})

describe('dedupeWords / stemKey', () => {
  it('убирает формы одного слова', () => {
    expect(dedupeWords(['бесплатно', 'Бесплатный', 'скачать', 'бесплатные'])).toEqual(['бесплатно', 'скачать'])
  })
  it('stemKey фразы', () => {
    expect(stemKey('своими руками')).toBe(stemKey('своим рукам'))
  })
})
