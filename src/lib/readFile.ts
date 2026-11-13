import { ParseError, type RawTable } from './parser'
import type { WorkerResponse } from './parser.worker'

/**
 * Читает отчёт в фоновом потоке (Web Worker), чтобы страница не «замирала»
 * на больших файлах. Если фоновый поток недоступен — читаем как обычно.
 */
/** Запасной путь без фонового потока: модуль чтения грузится только если понадобился. */
async function readOnMainThread(data: ArrayBuffer, fileName: string): Promise<RawTable> {
  const { readReport } = await import('./read')
  return readReport(data, fileName)
}

export async function readReportFile(file: File): Promise<RawTable> {
  const data = await file.arrayBuffer()
  if (typeof Worker === 'undefined') return readOnMainThread(data, file.name)

  let worker: Worker
  try {
    worker = new Worker(new URL('./parser.worker.ts', import.meta.url), { type: 'module' })
  } catch {
    return readOnMainThread(data, file.name)
  }

  return new Promise<RawTable>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      worker.terminate()
      const r = e.data
      if (r.ok) resolve(r.table)
      else reject(r.parseError ? new ParseError(r.message) : new Error(r.message))
    }
    worker.onerror = (e) => {
      worker.terminate()
      e.preventDefault()
      // фоновый поток не запустился — пробуем по-старому (копию данных мы сохранили)
      readOnMainThread(backup, file.name).then(resolve, reject)
    }
    // в фон отдаём копию: если поток не запустится, оригинал понадобится для запасного пути
    const backup = data.slice(0)
    worker.postMessage({ data, fileName: file.name }, [data])
  })
}
