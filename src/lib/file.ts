/** Расширения файлов отчёта, которые умеет читать Минусатор. */
export const SUPPORTED_EXTENSIONS = ['csv', 'tsv', 'txt', 'xlsx', 'xls'] as const

/** Расширение файла в нижнем регистре без точки ('' если его нет). */
export function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0 || dot === fileName.length - 1) return ''
  return fileName.slice(dot + 1).toLowerCase()
}

/** Можно ли загрузить файл с таким именем. */
export function isSupportedFile(fileName: string): boolean {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(getExtension(fileName))
}

/** Размер файла по-русски: «512 Б», «12,3 КБ», «1,5 МБ». */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1).replace('.', ',')} КБ`
  return `${(kb / 1024).toFixed(1).replace('.', ',')} МБ`
}
