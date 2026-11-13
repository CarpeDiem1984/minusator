/// <reference lib="webworker" />
// Фоновый поток: читает файл отчёта, пока страница остаётся отзывчивой.
import { ParseError } from './parser'
import { readReport } from './read'

export type WorkerRequest = { data: ArrayBuffer; fileName: string }
export type WorkerResponse =
  | { ok: true; table: ReturnType<typeof readReport> }
  | { ok: false; message: string; parseError: boolean }

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { data, fileName } = e.data
  let response: WorkerResponse
  try {
    response = { ok: true, table: readReport(data, fileName) }
  } catch (err) {
    response = {
      ok: false,
      parseError: err instanceof ParseError,
      message: err instanceof Error ? err.message : String(err),
    }
  }
  ;(self as unknown as DedicatedWorkerGlobalScope).postMessage(response)
}
