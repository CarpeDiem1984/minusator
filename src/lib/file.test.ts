import { describe, expect, it } from 'vitest'
import { formatFileSize, getExtension, isSupportedFile } from './file'

describe('getExtension', () => {
  it('возвращает расширение в нижнем регистре', () => {
    expect(getExtension('Отчёт.XLSX')).toBe('xlsx')
    expect(getExtension('a.b.csv')).toBe('csv')
  })
  it('пустая строка, если расширения нет', () => {
    expect(getExtension('report')).toBe('')
    expect(getExtension('.hidden')).toBe('')
    expect(getExtension('file.')).toBe('')
  })
})

describe('isSupportedFile', () => {
  it('принимает CSV, TSV, XLSX', () => {
    expect(isSupportedFile('search_queries_sample.csv')).toBe(true)
    expect(isSupportedFile('report.tsv')).toBe(true)
    expect(isSupportedFile('report.xlsx')).toBe(true)
  })
  it('отклоняет прочие файлы', () => {
    expect(isSupportedFile('photo.jpg')).toBe(false)
    expect(isSupportedFile('report.pdf')).toBe(false)
  })
})

describe('formatFileSize', () => {
  it('форматирует байты, КБ и МБ', () => {
    expect(formatFileSize(512)).toBe('512 Б')
    expect(formatFileSize(1536)).toBe('1,5 КБ')
    expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2,5 МБ')
  })
})
