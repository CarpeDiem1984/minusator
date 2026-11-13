import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import {
  autoMapColumns,
  buildRows,
  decodeText,
  findHeaderRow,
  parseDelimitedText,
  parseNumber,
  ParseError,
  aggregateRows,
} from './parser'
import { readReport } from './read'

const samplePath = resolve(__dirname, '../../samples/search_queries_sample.csv')
const sampleBytes = new Uint8Array(readFileSync(samplePath))

/** Кодирует строку в Windows-1251 (только латиница, цифры, знаки и кириллица — для тестов хватит). */
function encode1251(s: string): Uint8Array {
  const out: number[] = []
  for (const ch of s) {
    const c = ch.codePointAt(0)!
    if (c < 0x80) out.push(c)
    else if (c >= 0x410 && c <= 0x44f) out.push(c - 0x410 + 0xc0)
    else if (c === 0x401) out.push(0xa8)
    else if (c === 0x451) out.push(0xb8)
    else throw new Error(`нет в тестовом кодировщике: ${ch}`)
  }
  return new Uint8Array(out)
}

describe('образец samples/search_queries_sample.csv', () => {
  const table = readReport(sampleBytes, 'search_queries_sample.csv')
  const mapping = autoMapColumns(table.headers)
  const rows = buildRows(table, mapping)

  it('пропускает 2 служебные строки и находит заголовки', () => {
    expect(table.headerRowIndex).toBe(2)
    expect(table.headers[0]).toBe('Поисковый запрос')
    expect(table.delimiter).toBe(';')
    expect(table.encoding).toBe('utf-8')
  })

  it('находит все 7 колонок', () => {
    expect(mapping).toEqual({
      query: 0,
      campaign: 1,
      group: 2,
      impressions: 3,
      clicks: 4,
      cost: 5,
      conversions: 6,
    })
  })

  it('читает 20 запросов с правильными числами', () => {
    expect(rows).toHaveLength(20)
    expect(rows[0]).toEqual({
      query: 'купить диван угловой',
      campaign: 'Диваны_Поиск_Мск',
      group: 'Угловые',
      impressions: 1520,
      clicks: 64,
      cost: 3840.5,
      conversions: 6,
      brandMention: '',
    })
    const totalCost = rows.reduce((s, r) => s + r.cost, 0)
    expect(totalCost).toBeCloseTo(21_875.9, 2)
  })
})

describe('кодировка', () => {
  it('UTF-8 с BOM', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('Запрос;Клики')])
    expect(decodeText(bytes)).toEqual({ text: 'Запрос;Клики', encoding: 'utf-8' })
  })

  it('Windows-1251', () => {
    const csv = 'Поисковый запрос;Клики\nдиван ёлка;5\n'
    const table = readReport(encode1251(csv), 'report.csv')
    expect(table.encoding).toBe('windows-1251')
    expect(table.headers).toEqual(['Поисковый запрос', 'Клики'])
    expect(table.rows[0]).toEqual(['диван ёлка', '5'])
  })
})

describe('разделители', () => {
  it('табуляция', () => {
    const t = parseDelimitedText('Запрос\tПоказы\tКлики\nдиван\t10\t2')
    expect(t.delimiter).toBe('\t')
    expect(t.headers).toEqual(['Запрос', 'Показы', 'Клики'])
  })

  it('запятая с числами в кавычках', () => {
    const t = parseDelimitedText('Запрос,Расход\n"диван, угловой","1 234,56"')
    expect(t.delimiter).toBe(',')
    const rows = buildRows(t, autoMapColumns(t.headers))
    expect(rows[0].query).toBe('диван, угловой')
    expect(rows[0].cost).toBeCloseTo(1234.56)
  })

  it('пустой файл — понятная ошибка', () => {
    expect(() => parseDelimitedText('\n\n')).toThrow(ParseError)
  })
})

describe('поиск строки заголовков', () => {
  it('не путает служебную строку «Отчёт по поисковым запросам» с заголовками', () => {
    expect(
      findHeaderRow([
        ['Отчёт по поисковым запросам', '', ''],
        ['Период: 01.11.2026', '', ''],
        ['Поисковый запрос', 'Клики', 'Расход'],
      ]),
    ).toBe(2)
  })

  it('файл из одной колонки «Запрос»', () => {
    expect(findHeaderRow([['Запрос'], ['диван']])).toBe(0)
  })

  it('-1, если заголовков нет — колонки по номерам, первая строка не теряется', () => {
    const t = parseDelimitedText('диван;10\nкресло;5')
    expect(t.headerRowIndex).toBe(-1)
    expect(t.headers).toEqual(['Колонка 1', 'Колонка 2'])
    expect(autoMapColumns(t.headers).query).toBeUndefined()
    // пользователь вручную выбрал колонки
    const rows = buildRows(t, { query: 0, clicks: 1 })
    expect(rows.map((r) => [r.query, r.clicks])).toEqual([
      ['диван', 10],
      ['кресло', 5],
    ])
  })
})

describe('маппинг колонок', () => {
  it('реальные заголовки Мастера отчётов Директа', () => {
    const headers = [
      'Кампания',
      '№ Кампании',
      'Название группы',
      'Поисковый запрос',
      'Условие показа',
      'Показы',
      'Клики',
      'CTR (%)',
      'Расход (руб.)',
      'Ср. цена клика (руб.)',
      'Конверсия (%)',
      'Цена цели (руб.)',
      'Конверсии',
      'Стоимость конверсий (руб.)',
    ]
    expect(autoMapColumns(headers)).toEqual({
      query: 3,
      campaign: 0,
      group: 2,
      impressions: 5,
      clicks: 6,
      cost: 8,
      conversions: 12,
    })
  })

  it('«Стоимость» вместо «Расход», регистр не важен', () => {
    expect(autoMapColumns(['ЗАПРОС', 'стоимость (руб.)', 'КЛИКИ'])).toEqual({ query: 0, cost: 1, clicks: 2 })
  })

  it('только колонка запросов — остальное не обязательно', () => {
    const t = parseDelimitedText('Поисковый запрос\nдиван\nкресло')
    const m = autoMapColumns(t.headers)
    expect(m).toEqual({ query: 0 })
    expect(buildRows(t, m).map((r) => [r.query, r.cost])).toEqual([
      ['диван', 0],
      ['кресло', 0],
    ])
  })
})

describe('parseNumber', () => {
  it.each([
    ['1 234,56', 1234.56],
    ['1 520', 1520],
    ['3 840,50', 3840.5],
    ['1,234.56', 1234.56],
    ['512.00', 512],
    ['-', 0],
    ['—', 0],
    ['', 0],
    ['  ', 0],
    ['abc', 0],
    ['12,5 %', 12.5],
    ['95 руб.', 95],
  ])('%j → %d', (input, expected) => {
    expect(parseNumber(input)).toBeCloseTo(expected)
  })

  it('числа и пустые значения', () => {
    expect(parseNumber(42.5)).toBe(42.5)
    expect(parseNumber(undefined)).toBe(0)
    expect(parseNumber(null)).toBe(0)
    expect(parseNumber(Number.NaN)).toBe(0)
  })
})

describe('buildRows', () => {
  it('пропускает пустые запросы и строку «Итого»', () => {
    const t = parseDelimitedText('Запрос;Расход\nдиван;100\n;5\n-;3\nИтого;105\nВсего:;105')
    const rows = buildRows(t, autoMapColumns(t.headers))
    expect(rows.map((r) => r.query)).toEqual(['диван'])
  })

  it('схлопывает лишние пробелы в запросе', () => {
    const t = parseDelimitedText('Запрос;Клики\n  диван   угловой ;1')
    expect(buildRows(t, autoMapColumns(t.headers))[0].query).toBe('диван угловой')
  })
})

describe('XLSX', () => {
  function makeXlsx(sheets: Record<string, unknown[][]>): Uint8Array {
    const wb = XLSX.utils.book_new()
    for (const [name, aoa] of Object.entries(sheets)) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name)
    }
    return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }))
  }

  it('служебные строки сверху, числа как числа и как текст', () => {
    const bytes = makeXlsx({
      Отчёт: [
        ['Отчёт по поисковым запросам'],
        ['Период: 01.11.2026 - 10.11.2026'],
        ['Поисковый запрос', 'Кампания', 'Показы', 'Клики', 'Расход (руб.)', 'Конверсии'],
        ['диван угловой бесплатно', 'Диваны', 210, 9, 512, 0],
        ['купить диван', 'Диваны', '1 520', '64', '3 840,50', '-'],
      ],
    })
    const t = readReport(bytes, 'report.xlsx')
    const rows = buildRows(t, autoMapColumns(t.headers))
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ query: 'диван угловой бесплатно', impressions: 210, cost: 512 })
    expect(rows[1]).toMatchObject({ impressions: 1520, clicks: 64, cost: 3840.5, conversions: 0 })
  })

  it('ищет лист с заголовками, если первый лист не тот', () => {
    const bytes = makeXlsx({
      Инфо: [['Это сводка'], ['ничего полезного']],
      Запросы: [
        ['Запрос', 'Клики'],
        ['диван', 3],
      ],
    })
    const t = readReport(bytes, 'report.xlsx')
    expect(t.headers).toEqual(['Запрос', 'Клики'])
  })

  it('XLSX с неправильным расширением .csv всё равно читается', () => {
    const bytes = makeXlsx({ Лист1: [['Запрос'], ['диван']] })
    expect(readReport(bytes, 'report.csv').headers).toEqual(['Запрос'])
  })

  it('битый Excel — понятная ошибка', () => {
    expect(() => readReport(new Uint8Array([0x50, 0x4b, 1, 2, 3]), 'broken.xlsx')).toThrow(ParseError)
  })
})

describe('колонка «Упоминания брендов» (как в реальном отчёте Директа)', () => {
  it('находится и не мешает колонке запросов', () => {
    const headers = [
      'Тип условия показа',
      'Поисковый запрос',
      'Категория запроса',
      'Упоминания брендов в запросах',
      'Название кампании',
      '№ Кампании',
      'Название группы',
      '№ Группы',
      'Ключевая фраза',
      'Тип соответствия',
      'Расход, ₽',
      'Показы',
      'Клики',
      'Конверсии',
      'CR, %',
      'CPA, ₽',
    ]
    expect(autoMapColumns(headers)).toEqual({
      query: 1,
      brandMention: 3,
      campaign: 4,
      group: 6,
      cost: 10,
      impressions: 11,
      clicks: 12,
      conversions: 13,
    })
  })

  it('строка «Итого» сразу под заголовками и пустые запросы пропускаются', () => {
    const t = parseDelimitedText(
      [
        'Клиент: Тест',
        'Отчет: Поисковые запросы',
        '',
        'Тип условия показа;Поисковый запрос;Упоминания брендов в запросах;Название кампании;Расход, ₽',
        'Итого;;;;100',
        'Фраза;лосьон;Запросы без упоминания брендов;demo_category;60',
        'Автотаргетинг;;Запросы без упоминания брендов;demo_category;40',
      ].join('\n'),
    )
    const rows = buildRows(t, autoMapColumns(t.headers))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ query: 'лосьон', brandMention: 'Запросы без упоминания брендов', cost: 60 })
  })
})

describe('aggregateRows', () => {
  const base = { impressions: 0, clicks: 0, cost: 0, conversions: 0, brandMention: '' }
  it('склеивает один запрос из разных групп одной кампании', () => {
    const rows = aggregateRows([
      { ...base, query: 'Лосьон для ногтей', campaign: 'A', group: 'g1', clicks: 2, cost: 10.1 },
      { ...base, query: 'кресло', campaign: 'A', group: 'g1', clicks: 1 },
      { ...base, query: 'лосьон для ногтей', campaign: 'A', group: 'g2', clicks: 3, cost: 20.2, conversions: 1 },
      { ...base, query: 'лосьон для ногтей', campaign: 'A', group: 'g1', clicks: 1, cost: 0 },
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ query: 'Лосьон для ногтей', group: 'g1, g2', clicks: 6, cost: 30.3, conversions: 1 })
  })
  it('в разных кампаниях — разные строки', () => {
    const rows = aggregateRows([
      { ...base, query: 'лосьон', campaign: 'A', group: '' },
      { ...base, query: 'лосьон', campaign: 'B', group: '' },
    ])
    expect(rows).toHaveLength(2)
  })
})
