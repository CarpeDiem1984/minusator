import { useMemo, useRef, useState } from 'react'
import { CAMPAIGN_TYPE_LABELS, type CampaignType } from '../lib/campaigns'
import { REASON_LABELS, type ClassifiedRow, type Settings } from '../lib/classifier'
import { formatMoney, formatNumber } from '../lib/format'
import {
  dedupeWords,
  DIRECT_MINUS_LIMIT,
  formatMinusWords,
  frequencyCandidates,
  ruleCandidates,
  ruleExcludeKeys,
  type Candidate,
  type MinusFormat,
} from '../lib/minus'
import { normalize } from '../lib/text'

type Props = {
  rows: ClassifiedRow[]
  settings: Settings
  /** Виды кампаний, которые есть в отчёте (в порядке вкладок). */
  types: CampaignType[]
}

const PAGE = 100

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // запасной способ для браузеров, где clipboard API недоступен
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    ta.remove()
    return ok
  }
}

function downloadText(text: string, fileName: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

const FILE_NAMES: Record<CampaignType, string> = {
  brand: 'minus-brand.txt',
  category: 'minus-category.txt',
  competitor: 'minus-competitor.txt',
  general: 'minus-general.txt',
}

export function MinusPanel({ rows, settings, types }: Props) {
  const [active, setActive] = useState<CampaignType>(types[0])
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [manual, setManual] = useState<Record<CampaignType, string[]>>({ brand: [], category: [], competitor: [], general: [] })
  const [format, setFormat] = useState<MinusFormat>('lines')
  const [fixForm, setFixForm] = useState(false)
  const [showFreq, setShowFreq] = useState(false)
  const [ruleLimit, setRuleLimit] = useState(PAGE)
  const [freqLimit, setFreqLimit] = useState(PAGE)
  const [newWord, setNewWord] = useState('')
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null)
  const outputRef = useRef<HTMLTextAreaElement>(null)

  const type = types.includes(active) ? active : types[0]

  const rule = useMemo(() => ruleCandidates(rows, type, settings), [rows, type, settings])
  const freq = useMemo(() => {
    if (!showFreq) return []
    return frequencyCandidates(rows, type, settings, ruleExcludeKeys(rule))
  }, [showFreq, rows, type, settings, rule])

  const pickKey = (c: Candidate) => `${type}|${c.source}|${c.key}`
  const isChecked = (c: Candidate) => picked[pickKey(c)] ?? c.source === 'rule'
  const toggle = (c: Candidate) => setPicked((p) => ({ ...p, [pickKey(c)]: !isChecked(c) }))
  const setAll = (list: Candidate[], value: boolean) =>
    setPicked((p) => {
      const next = { ...p }
      for (const c of list) next[pickKey(c)] = value
      return next
    })

  const selected = dedupeWords([
    ...rule.filter(isChecked).map((c) => c.word),
    ...freq.filter(isChecked).map((c) => c.word),
    ...manual[type],
  ])
  const text = formatMinusWords(selected, format, fixForm)
  const tooLong = text.length > DIRECT_MINUS_LIMIT

  function addManual() {
    const w = normalize(newWord.replace(/^[-!]+/, ''))
    if (!w) return
    setManual((m) => ({ ...m, [type]: m[type].includes(w) ? m[type] : [...m[type], w] }))
    setNewWord('')
  }

  async function onCopy() {
    if (!text) return
    if (await copyText(text)) {
      setCopied('ok')
      setTimeout(() => setCopied(null), 2000)
    } else {
      // браузер не дал скопировать — выделяем текст, пусть человек нажмёт Cmd+C
      outputRef.current?.focus()
      outputRef.current?.select()
      setCopied('failed')
    }
  }

  function switchTab(t: CampaignType) {
    setActive(t)
    setRuleLimit(PAGE)
    setFreqLimit(PAGE)
    setCopied(null)
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="px-5 pt-4">
        <h2 className="font-semibold">Минус-слова</h2>
        <p className="mt-1 text-sm text-slate-500">
          Отдельный список для каждого вида кампании. Снимите галочки с лишнего, добавьте своё и скопируйте в
          настройки кампании в Директе.
        </p>
      </div>

      <div className="mt-3 flex gap-1 overflow-x-auto border-b border-slate-200 px-5">
        {types.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchTab(t)}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm ${
              t === type ? 'border-rose-600 font-medium text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {CAMPAIGN_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-5">
          <CandidateList
            title="Найдено по правилам"
            empty="В кампаниях этого вида мусора по правилам не нашлось."
            list={rule}
            limit={ruleLimit}
            onMore={() => setRuleLimit((l) => l + PAGE)}
            isChecked={isChecked}
            onToggle={toggle}
            onAll={(v) => setAll(rule, v)}
          />

          <div>
            <button
              type="button"
              onClick={() => setShowFreq((s) => !s)}
              className="text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              {showFreq ? '▾' : '▸'} Показать слова, которые есть только в 🔴/🟡 запросах
            </button>
            {showFreq && (
              <div className="mt-3">
                <p className="mb-2 text-xs text-slate-500">
                  Этих слов нет ни в одном 🟢 запросе кампаний этого вида — возможно, это мусор, которого нет в
                  словарях. По умолчанию не отмечены.
                </p>
                <CandidateList
                  list={freq}
                  empty="Таких слов нет."
                  limit={freqLimit}
                  onMore={() => setFreqLimit((l) => l + PAGE)}
                  isChecked={isChecked}
                  onToggle={toggle}
                  onAll={(v) => setAll(freq, v)}
                />
              </div>
            )}
          </div>

          <div>
            <div className="text-sm font-medium text-slate-700">Добавить слово вручную</div>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                addManual()
              }}
            >
              <input
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                placeholder="например, оптом"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              />
              <button type="submit" className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700">
                Добавить
              </button>
            </form>
            {manual[type].length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {manual[type].map((w) => (
                  <span key={w} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm">
                    {w}
                    <button
                      type="button"
                      aria-label={`Убрать ${w}`}
                      onClick={() => setManual((m) => ({ ...m, [type]: m[type].filter((x) => x !== w) }))}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <div className="flex rounded-lg border border-slate-300 p-0.5 text-sm">
            {(
              [
                ['lines', 'По одному в строке'],
                ['minus', '-слово -слово'],
              ] as const
            ).map(([f, label]) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`flex-1 rounded-md px-2 py-1 ${format === f ? 'bg-slate-800 text-white' : 'text-slate-600'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={fixForm}
              onChange={(e) => setFixForm(e.target.checked)}
              className="h-4 w-4 accent-rose-600"
            />
            Зафиксировать форму слова (!слово)
          </label>

          <textarea
            ref={outputRef}
            readOnly
            value={text}
            rows={12}
            placeholder="Отметьте слова слева"
            className="w-full resize-y rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm"
          />
          {format === 'minus' && selected.some((w) => w.includes(' ')) && (
            <p className="text-xs text-slate-500">
              Фразы из нескольких слов записаны отдельными строками: минус перед каждым словом фразы заминусовал бы
              слишком много.
            </p>
          )}

          <div className={`text-sm ${tooLong ? 'font-medium text-rose-700' : 'text-slate-500'}`}>
            Слов: {formatNumber(selected.length)} · символов: {formatNumber(text.length)} из{' '}
            {formatNumber(DIRECT_MINUS_LIMIT)}
            {tooLong && ' — список длиннее лимита Директа для кампании, сократите его.'}
          </div>

          {copied === 'failed' && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Браузер не дал скопировать автоматически. Текст выделен — нажмите Cmd+C (на Windows — Ctrl+C).
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCopy}
              disabled={!text}
              className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-40"
            >
              {copied === 'ok' ? 'Скопировано ✓' : 'Скопировать'}
            </button>
            <button
              type="button"
              onClick={() => downloadText(text, FILE_NAMES[type])}
              disabled={!text}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Скачать .txt
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

type ListProps = {
  title?: string
  empty: string
  list: Candidate[]
  limit: number
  onMore: () => void
  isChecked: (c: Candidate) => boolean
  onToggle: (c: Candidate) => void
  onAll: (value: boolean) => void
}

function CandidateList({ title, empty, list, limit, onMore, isChecked, onToggle, onAll }: ListProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        {title && <div className="text-sm font-medium text-slate-700">{title}</div>}
        {list.length > 0 && (
          <div className="ml-auto flex gap-3 text-xs text-slate-500">
            <button type="button" onClick={() => onAll(true)} className="hover:text-slate-900">
              отметить все
            </button>
            <button type="button" onClick={() => onAll(false)} className="hover:text-slate-900">
              снять все
            </button>
          </div>
        )}
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="w-8 px-3 py-1.5" />
                <th className="px-3 py-1.5 text-left font-medium">Слово</th>
                <th className="px-3 py-1.5 text-left font-medium">Почему</th>
                <th className="px-3 py-1.5 text-right font-medium whitespace-nowrap">Запросов</th>
                <th className="px-3 py-1.5 text-right font-medium">Расход</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.slice(0, limit).map((c) => (
                <tr key={c.key} className="cursor-pointer hover:bg-slate-50" onClick={() => onToggle(c)}>
                  <td className="px-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={isChecked(c)}
                      onChange={() => onToggle(c)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 accent-rose-600"
                    />
                  </td>
                  <td className="px-3 py-1.5 font-medium text-slate-900">{c.word}</td>
                  <td className="px-3 py-1.5 text-slate-500">
                    {c.kinds.length > 0 ? c.kinds.map((k) => REASON_LABELS[k]).join(', ') : 'только в мусоре'}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(c.queries)}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">{formatMoney(c.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.length > limit && (
        <button type="button" onClick={onMore} className="mt-2 text-sm text-slate-600 hover:text-slate-900">
          Показать ещё (осталось {formatNumber(list.length - limit)})
        </button>
      )}
    </div>
  )
}
