import { useMemo, useState } from 'react'
import { ColumnMapper } from './components/ColumnMapper'
import { FileDropZone } from './components/FileDropZone'
import { QueriesTable } from './components/QueriesTable'
import { formatFileSize } from './lib/file'
import { formatNumber } from './lib/format'
import { autoMapColumns, buildRows, ParseError, readReport, type ColumnMapping, type RawTable } from './lib/parser'

type Loaded = { file: File; table: RawTable }

export default function App() {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [showMapper, setShowMapper] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setLoading(true)
    setError(null)
    try {
      const table = readReport(await file.arrayBuffer(), file.name)
      const auto = autoMapColumns(table.headers)
      setLoaded({ file, table })
      setMapping(auto)
      setShowMapper(auto.query === undefined)
    } catch (e) {
      setLoaded(null)
      setError(e instanceof ParseError ? e.message : 'Не получилось прочитать файл. Проверьте, что это отчёт в CSV или XLSX.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setLoaded(null)
    setMapping({})
    setError(null)
    setShowMapper(false)
  }

  const rows = useMemo(() => (loaded ? buildRows(loaded.table, mapping) : []), [loaded, mapping])
  const noQueryColumn = loaded !== null && mapping.query === undefined

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:py-16">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Минус<span className="text-rose-600">атор</span>
          </h1>
          <p className="mt-2 text-slate-600">
            Загрузите отчёт по поисковым запросам Яндекс Директа — найдём мусорные запросы и соберём список
            минус-слов.
          </p>
        </header>

        {!loaded && <FileDropZone onFile={handleFile} />}
        {loading && <p className="mt-4 text-sm text-slate-500">Читаю файл…</p>}
        {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {loaded && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
              <div className="min-w-0">
                <div className="truncate font-medium">{loaded.file.name}</div>
                <div className="text-sm text-slate-500">
                  {formatFileSize(loaded.file.size)} · запросов: {formatNumber(rows.length)}
                </div>
              </div>
              <button
                type="button"
                onClick={reset}
                className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Загрузить другой файл
              </button>
            </div>

            <section className="rounded-xl border border-slate-200 bg-white px-5 py-4">
              {noQueryColumn ? (
                <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Не нашёл колонку с поисковыми запросами. Укажите вручную, в какой колонке файла что лежит.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowMapper((s) => !s)}
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  {showMapper ? '▾' : '▸'} Колонки определились неправильно? Настроить вручную
                </button>
              )}
              {(showMapper || noQueryColumn) && (
                <div className={noQueryColumn ? '' : 'mt-4'}>
                  <ColumnMapper
                    headers={loaded.table.headers}
                    example={loaded.table.rows[0]}
                    mapping={mapping}
                    onChange={setMapping}
                  />
                </div>
              )}
            </section>

            {!noQueryColumn &&
              (rows.length > 0 ? (
                <QueriesTable rows={rows} mapping={mapping} />
              ) : (
                <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  В выбранной колонке нет ни одного запроса. Проверьте, что колонка выбрана правильно.
                </p>
              ))}
          </div>
        )}
      </main>

      <footer className="px-4 py-6 text-center text-sm text-slate-500">
        🔒 Файлы обрабатываются в вашем браузере и никуда не отправляются.
      </footer>
    </div>
  )
}
