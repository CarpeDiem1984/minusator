import * as XLSX from 'xlsx'
import { getExtension } from './file'
import { buildRawTable, decodeText, parseDelimitedText, ParseError, type RawTable } from './parser'

/*
 * Чтение файла отчёта. Вынесено отдельно от parser.ts, потому что библиотека для Excel
 * весит ~400 КБ: этот модуль работает в фоновом потоке и не тормозит открытие сайта.
 */

// ---------- XLSX ----------

export function parseWorkbook(data: ArrayBuffer | Uint8Array): RawTable {
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(data, { type: 'array' })
  } catch {
    throw new ParseError('Не получилось открыть Excel-файл. Возможно, он повреждён или защищён паролем.')
  }

  // Берём первый лист, где нашлась строка заголовков; если такого нет — первый непустой лист.
  let fallback: RawTable | null = null
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    const rows = XLSX.utils
      .sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true, blankrows: false })
      .map((r) => r.map(cellToString))
    const table = buildRawTable(rows)
    if (!table) continue
    if (table.headerRowIndex >= 0) return table
    fallback ??= table
  }
  if (!fallback) throw new ParseError('В Excel-файле нет ни одной строки с данными.')
  return fallback
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return String(value)
  if (value instanceof Date) return value.toLocaleDateString('ru-RU')
  return String(value).trim()
}

// ---------- Общее ----------

/** Читает файл отчёта любого поддерживаемого формата. */
export function readReport(data: ArrayBuffer | Uint8Array, fileName: string): RawTable {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const ext = getExtension(fileName)

  if (ext === 'xlsx' || ext === 'xls' || isZipOrOle(bytes)) {
    return parseWorkbook(bytes)
  }
  const { text, encoding } = decodeText(bytes)
  const table = parseDelimitedText(text)
  table.encoding = encoding
  return table
}

/** XLSX — это zip («PK»), старый XLS — OLE-контейнер. Ловим случаи, когда расширение не то. */
function isZipOrOle(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b
  const ole = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0
  return zip || ole
}
