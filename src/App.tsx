import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { BrandSuggestions, type BrandMark } from './components/BrandSuggestions'
import { CampaignsPanel } from './components/CampaignsPanel'
import { ColumnMapper } from './components/ColumnMapper'
import { FileDropZone } from './components/FileDropZone'
import { HowItWorks } from './components/HowItWorks'
import { MinusPanel } from './components/MinusPanel'
import { QueriesTable } from './components/QueriesTable'
import { SettingsPanel } from './components/SettingsPanel'
import { SummaryPanel } from './components/SummaryPanel'
import { CAMPAIGN_TYPES, detectCampaignType, listCampaigns, type CampaignType } from './lib/campaigns'
import { classifyRows, type Available } from './lib/classifier'
import { formatFileSize } from './lib/file'
import { formatNumber } from './lib/format'
import { brandSuggestions } from './lib/minus'
import {
  aggregateRows,
  autoMapColumns,
  buildRows,
  ParseError,
  type ColumnMapping,
  type RawTable,
} from './lib/parser'
import { DEFAULT_FORM, formToSettings, type SettingsForm } from './lib/settingsForm'
import { readReportFile } from './lib/readFile'
import { clearForm, loadForm, saveForm } from './lib/storage'
import { computeSummary } from './lib/summary'
import { DEFAULT_FILTERS, type Filters } from './lib/table'

type Loaded = { file: File; table: RawTable; id: number }

export default function App() {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [showMapper, setShowMapper] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Виды кампаний, которые пользователь поменял вручную (остальные — по названию). */
  const [typeOverrides, setTypeOverrides] = useState<Record<string, CampaignType>>({})
  // настройки клиента подставляются из прошлого визита и сохраняются при каждом изменении
  const [form, setForm] = useState<SettingsForm>(() => loadForm())
  useEffect(() => saveForm(form), [form])
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)

  async function handleFile(file: File) {
    setLoading(true)
    setError(null)
    try {
      const table = await readReportFile(file)
      const auto = autoMapColumns(table.headers)
      setLoaded({ file, table, id: Date.now() })
      setMapping(auto)
      setShowMapper(auto.query === undefined)
      setTypeOverrides({})
      setFilters(DEFAULT_FILTERS)
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
    setTypeOverrides({})
    setFilters(DEFAULT_FILTERS)
  }

  const rows = useMemo(() => (loaded ? aggregateRows(buildRows(loaded.table, mapping)) : []), [loaded, mapping])
  const campaigns = useMemo(() => listCampaigns(rows), [rows])
  const campaignTypes = useMemo(() => {
    const t: Record<string, CampaignType> = {}
    for (const c of campaigns) t[c.name] = typeOverrides[c.name] ?? detectCampaignType(c.name)
    return t
  }, [campaigns, typeOverrides])
  const available: Available = useMemo(
    () => ({
      clicks: mapping.clicks !== undefined,
      cost: mapping.cost !== undefined,
      conversions: mapping.conversions !== undefined,
      brandMention: mapping.brandMention !== undefined,
    }),
    [mapping],
  )

  // пересчёт на 40 000+ запросов занимает доли секунды — не тормозим ввод в поля настроек
  const deferredForm = useDeferredValue(form)
  const settings = useMemo(() => formToSettings(deferredForm), [deferredForm])
  const classified = useMemo(
    () => classifyRows(rows, campaignTypes, settings, available),
    [rows, campaignTypes, settings, available],
  )

  const summary = useMemo(() => computeSummary(classified), [classified])

  function resetSettings() {
    clearForm()
    setForm(DEFAULT_FORM)
  }

  const typesPresent = useMemo(
    () => CAMPAIGN_TYPES.filter((t) => Object.values(campaignTypes).includes(t)),
    [campaignTypes],
  )
  const suggestions = useMemo(
    () => (available.brandMention ? brandSuggestions(classified, settings) : []),
    [available.brandMention, classified, settings],
  )

  /** Кнопки «конкурент / магазин / не бренд»: дописываем слово в нужное поле настроек. */
  function markBrand(word: string, mark: BrandMark) {
    const field = mark === 'competitor' ? 'otherCompetitors' : mark === 'store' ? 'extraStores' : 'notBrands'
    setForm((f) => ({ ...f, [field]: f[field].trim() ? `${f[field].trim()}, ${word}` : word }))
  }

  const noQueryColumn = loaded !== null && mapping.query === undefined
  const needsBrand =
    settings.brandWords.length === 0 && Object.values(campaignTypes).some((t) => t !== 'general')

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:py-16">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Минус<span className="text-rose-600">атор</span>
          </h1>
          <p className="mt-2 text-slate-600">
            Загрузите отчёт по поисковым запросам Яндекс Директа — найдём мусорные запросы и соберём список
            минус-слов.
          </p>
        </header>

        {!loaded && !loading && (
          <>
            <FileDropZone onFile={handleFile} />
            {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            <HowItWorks />
          </>
        )}
        {loading && (
          <p className="rounded-xl border border-slate-200 bg-white px-5 py-6 text-center text-slate-600">
            <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-rose-200 border-t-rose-600 align-[-2px]" />
            Читаю файл… Большие отчёты читаются несколько секунд.
          </p>
        )}
        {loaded && !loading && (
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

            {!noQueryColumn && rows.length === 0 && (
              <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                В выбранной колонке нет ни одного запроса. Проверьте, что колонка выбрана правильно.
              </p>
            )}

            {!noQueryColumn && rows.length > 0 && (
              <>
                <CampaignsPanel
                  campaigns={campaigns}
                  types={campaignTypes}
                  onChange={(name, type) => setTypeOverrides((o) => ({ ...o, [name]: type }))}
                />
                <SettingsPanel form={form} onChange={setForm} onReset={resetSettings} />
                {needsBrand && (
                  <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Укажите слова бренда клиента в настройках — без них не работают правила брендовой, категорийной и
                    конкурентной кампаний.
                  </p>
                )}
                <SummaryPanel summary={summary} hasCost={available.cost} />
                <QueriesTable rows={classified} mapping={mapping} filters={filters} onFiltersChange={setFilters} />
                <BrandSuggestions suggestions={suggestions} onMark={markBrand} />
                <MinusPanel key={loaded.id} rows={classified} settings={settings} types={typesPresent} />
              </>
            )}
          </div>
        )}
      </main>

      <footer className="px-4 py-6 text-center text-sm text-slate-500">
        🔒 Файлы обрабатываются в вашем браузере и никуда не отправляются.
      </footer>
    </div>
  )
}
