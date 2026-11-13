import { describe, expect, it } from 'vitest'
import type { ClassifiedRow } from './classifier'
import { countByStatus, DEFAULT_FILTERS, filterRows, sortRows } from './table'

const row = (query: string, extra: Partial<ClassifiedRow>): ClassifiedRow => ({
  query,
  campaign: 'c',
  group: '',
  impressions: 0,
  clicks: 0,
  cost: 0,
  conversions: 0,
  brandMention: '',
  campaignType: 'general',
  status: 'green',
  reasons: [],
  ...extra,
})

const rows = [
  row('диван бесплатно', { status: 'red', cost: 50, reasons: [{ kind: 'free', severity: 'red', words: ['бесплатно'], phrases: ['бесплатно'] }] }),
  row('купить диван', { cost: 300, campaignType: 'category' }),
  row('Диван ёлка', { status: 'yellow', cost: 100 }),
]

describe('filterRows', () => {
  it('по статусу, виду кампании, причине и поиску', () => {
    expect(filterRows(rows, { ...DEFAULT_FILTERS, status: 'red' }).map((r) => r.query)).toEqual(['диван бесплатно'])
    expect(filterRows(rows, { ...DEFAULT_FILTERS, campaignType: 'category' })).toHaveLength(1)
    expect(filterRows(rows, { ...DEFAULT_FILTERS, reason: 'free' })).toHaveLength(1)
    expect(filterRows(rows, { ...DEFAULT_FILTERS, search: 'елка' })).toHaveLength(1)
    expect(filterRows(rows, { ...DEFAULT_FILTERS, search: ' ДИВАН ' })).toHaveLength(3)
  })
})

describe('sortRows', () => {
  it('по расходу и по статусу', () => {
    expect(sortRows(rows, { key: 'cost', dir: 'desc' }).map((r) => r.cost)).toEqual([300, 100, 50])
    expect(sortRows(rows, { key: 'status', dir: 'asc' }).map((r) => r.status)).toEqual(['red', 'yellow', 'green'])
  })
  it('не меняет исходный массив', () => {
    const copy = [...rows]
    sortRows(rows, { key: 'query', dir: 'asc' })
    expect(rows).toEqual(copy)
  })
})

describe('countByStatus', () => {
  it('считает', () => {
    expect(countByStatus(rows)).toEqual({ all: 3, red: 1, yellow: 1, green: 1 })
  })
})
