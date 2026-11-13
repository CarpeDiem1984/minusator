import Papa from 'papaparse'

/** Поля отчёта, которые нужны Минусатору. Обязательно только `query`. */
export type Field =
  | 'query'
  | 'campaign'
  | 'group'
  | 'impressions'
  | 'clicks'
  | 'cost'
  | 'conversions'
  | 'brandMention'

export const FIELDS: Field[] = [
  'query',
  'campaign',
  'group',
  'impressions',
  'clicks',
  'cost',
  'conversions',
  'brandMention',
]

export const FIELD_LABELS: Record<Field, string> = {
  query: 'Поисковый запрос',
  campaign: 'Кампания',
  group: 'Группа',
  impressions: 'Показы',
  clicks: 'Клики',
  cost: 'Расход',
  conversions: 'Конверсии',
  brandMention: 'Упоминания брендов',
}

export const METRIC_FIELDS = ['impressions', 'clicks', 'cost', 'conversions'] as const
export type MetricField = (typeof METRIC_FIELDS)[number]

/** Номер колонки (с нуля) для каждого найденного поля. */
export type ColumnMapping = Partial<Record<Field, number>>

/** Таблица из файла: заголовки и строки данных под ними (всё строками). */
export type RawTable = {
  headers: string[]
  rows: string[][]
  /**
   * Номер строки заголовков среди непустых строк (с нуля). -1 — заголовков не нашлось:
   * тогда headers = «Колонка 1», «Колонка 2»…, а все строки файла попадают в rows.
   */
  headerRowIndex: number
  /** Что удалось определить про файл — для подсказок пользователю. */
  encoding?: 'utf-8' | 'windows-1251'
  delimiter?: string
}

export type QueryRow = {
  query: string
  campaign: string
  group: string
  impressions: number
  clicks: number
  cost: number
  conversions: number
  /** Значение колонки Директа «Упоминания брендов в запросах» ('' если колонки нет). */
  brandMention: string
}

export class ParseError extends Error {}

// ---------- Кодировка ----------

/** Декодирует байты: UTF-8, а если файл в нём невалиден — Windows-1251. */
export function decodeText(bytes: Uint8Array): { text: string; encoding: 'utf-8' | 'windows-1251' } {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return { text: stripBom(text), encoding: 'utf-8' }
  } catch {
    const text = new TextDecoder('windows-1251').decode(bytes)
    return { text: stripBom(text), encoding: 'windows-1251' }
  }
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

// ---------- CSV / TSV ----------

const DELIMITERS = [';', '\t', ','] as const

/**
 * Разбирает текст CSV/TSV. Разделитель определяется автоматически:
 * пробуем каждый и берём тот, при котором в строке заголовков больше всего колонок.
 */
export function parseDelimitedText(text: string): RawTable {
  let best: { table: RawTable; score: number } | null = null

  for (const delimiter of DELIMITERS) {
    const result = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: 'greedy' })
    const rows = result.data.map((r) => r.map((c) => (c ?? '').trim()))
    const table = buildRawTable(rows)
    if (!table) continue
    table.delimiter = delimiter
    const found = table.headerRowIndex >= 0 ? 1000 : 0
    const score = found + table.headers.filter((h) => h !== '').length
    if (!best || score > best.score) best = { table, score }
  }

  if (!best) throw new ParseError('Файл пустой — в нём нет ни одной строки с данными.')
  return best.table
}

/**
 * Номер строки заголовков — первой строки, где есть короткая ячейка со словом «запрос»
 * и ещё хотя бы одна заполненная ячейка. Служебная строка «Отчёт по поисковым запросам;;;;»
 * так не подойдёт: в ней всего одна ячейка. Для файла из одной колонки подойдёт ячейка,
 * равная «Запрос» / «Поисковый запрос». -1, если ничего не нашлось.
 */
export function findHeaderRow(rows: string[][]): number {
  return rows.findIndex((row) => {
    const filled = row.filter((c) => c !== '')
    const hasQueryCell = row.some((cell) => {
      const h = normalizeHeader(cell)
      return h.includes('запрос') && h.length <= 40
    })
    if (hasQueryCell && filled.length >= 2) return true
    return filled.length === 1 && (RULES.query.exact ?? []).includes(normalizeHeader(filled[0]))
  })
}

export function buildRawTable(rows: string[][]): RawTable | null {
  const nonEmpty = rows.filter((r) => r.some((c) => c !== ''))
  if (nonEmpty.length === 0) return null

  const headerRowIndex = findHeaderRow(nonEmpty)

  if (headerRowIndex < 0) {
    // Заголовков нет — все строки считаем данными, колонки называем по номерам.
    const width = Math.max(...nonEmpty.map((r) => r.length))
    const pad = (r: string[]) => Array.from({ length: width }, (_, i) => r[i] ?? '')
    return {
      headers: Array.from({ length: width }, (_, i) => `Колонка ${i + 1}`),
      rows: nonEmpty.map(pad),
      headerRowIndex,
    }
  }

  const width = Math.max(...nonEmpty.slice(headerRowIndex).map((r) => r.length))
  const pad = (r: string[]) => Array.from({ length: width }, (_, i) => r[i] ?? '')
  return {
    headers: pad(nonEmpty[headerRowIndex]),
    rows: nonEmpty.slice(headerRowIndex + 1).map(pad),
    headerRowIndex,
  }
}

// ---------- Маппинг колонок ----------

type Rule = { include: string[]; exclude?: string[]; exact?: string[] }

/**
 * Как узнать колонку по названию (сравнение без учёта регистра, по вхождению).
 * exclude нужен, чтобы «Ср. цена клика» не приняли за клики, а «Конверсия (%)» — за конверсии.
 */
const RULES: Record<Field, Rule> = {
  query: { include: ['запрос'], exact: ['поисковый запрос', 'запрос'] },
  campaign: { include: ['кампани'], exclude: ['№', 'id'], exact: ['кампания', 'название кампании'] },
  group: { include: ['групп'], exclude: ['№', 'id'], exact: ['группа', 'название группы'] },
  impressions: { include: ['показ'], exclude: ['услови', 'доля', '%', 'позиц'], exact: ['показы'] },
  clicks: { include: ['клик'], exclude: ['цена', 'стоимост', '%', 'ctr', 'доля'], exact: ['клики'] },
  cost: {
    include: ['расход', 'стоимост'],
    exclude: ['клик', 'конверси', 'цел', 'показ', '%'],
    exact: ['расход', 'стоимость'],
  },
  conversions: {
    include: ['конверси'],
    exclude: ['%', 'стоимост', 'цена', 'доля', 'процент'],
    exact: ['конверсии'],
  },
  brandMention: { include: ['упоминан'], exact: ['упоминания брендов в запросах'] },
}

function normalizeHeader(h: string): string {
  // «Расход (руб.)» → «расход»: скобки с единицами не мешают точному совпадению
  return h.toLowerCase().replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim()
}

function scoreHeader(header: string, rule: Rule): number {
  const h = normalizeHeader(header)
  if (!h) return 0
  if (rule.exact?.includes(h)) return 2
  if (rule.exclude?.some((x) => h.includes(x))) return 0
  return rule.include.some((x) => h.includes(x)) ? 1 : 0
}

/** Автоматически находит колонки по названиям. Каждая колонка используется не больше одного раза. */
export function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  const used = new Set<number>()
  for (const field of FIELDS) {
    let bestIdx = -1
    let bestScore = 0
    headers.forEach((header, idx) => {
      if (used.has(idx)) return
      const score = scoreHeader(header, RULES[field])
      if (score > bestScore) {
        bestScore = score
        bestIdx = idx
      }
    })
    if (bestIdx >= 0) {
      mapping[field] = bestIdx
      used.add(bestIdx)
    }
  }
  return mapping
}

// ---------- Числа ----------

/** «1 234,56» → 1234.56; «-», «—», пусто → 0. */
export function parseNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value === null || value === undefined) return 0
  let s = String(value)
    .replace(/[\s  ]/g, '')
    .replace(/(руб\.?|₽|%)/gi, '')
  if (s === '' || /^[-–—]+$/.test(s)) return 0
  // «1,234.56» (запятая — разделитель тысяч) vs «1234,56» (запятая — десятичная)
  if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, '')
  else s = s.replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

// ---------- Строки отчёта ----------

/** Итоговые строки в конце выгрузки Директа — это не запросы. */
// (\b в JS не работает с кириллицей, поэтому проверяем «дальше не буква»)
const TOTAL_ROW = /^(итого|всего)(?![а-яё])/i

export function buildRows(table: RawTable, mapping: ColumnMapping): QueryRow[] {
  const q = mapping.query
  if (q === undefined) return []
  const text = (row: string[], f: Field) => {
    const i = mapping[f]
    return i === undefined ? '' : (row[i] ?? '').trim()
  }
  const num = (row: string[], f: Field) => {
    const i = mapping[f]
    return i === undefined ? 0 : parseNumber(row[i])
  }

  const result: QueryRow[] = []
  for (const row of table.rows) {
    const query = (row[q] ?? '').trim().replace(/\s+/g, ' ')
    if (!query || query === '-' || TOTAL_ROW.test(query)) continue
    result.push({
      query,
      campaign: text(row, 'campaign'),
      group: text(row, 'group'),
      impressions: num(row, 'impressions'),
      clicks: num(row, 'clicks'),
      cost: num(row, 'cost'),
      conversions: num(row, 'conversions'),
      brandMention: text(row, 'brandMention'),
    })
  }
  return result
}

/**
 * Склеивает одинаковые запросы внутри одной кампании (они бывают в разных группах):
 * метрики складываются, группы перечисляются через запятую.
 * Сравнение запросов без учёта регистра и разницы ё/е. Порядок — по первому появлению.
 */
export function aggregateRows(rows: QueryRow[]): QueryRow[] {
  const byKey = new Map<string, { row: QueryRow; groups: Set<string> }>()
  for (const r of rows) {
    const key = `${r.campaign}\u0000${r.query.toLowerCase().replace(/ё/g, 'е')}`
    const found = byKey.get(key)
    if (!found) {
      byKey.set(key, { row: { ...r }, groups: new Set(r.group ? [r.group] : []) })
      continue
    }
    const a = found.row
    a.impressions += r.impressions
    a.clicks += r.clicks
    a.cost += r.cost
    a.conversions += r.conversions
    if (!a.brandMention) a.brandMention = r.brandMention
    if (r.group) found.groups.add(r.group)
  }
  return [...byKey.values()].map(({ row, groups }) => ({
    ...row,
    cost: Math.round(row.cost * 100) / 100,
    group: [...groups].join(', '),
  }))
}
