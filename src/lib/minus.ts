import stopwords from '../dictionaries/stopwords.json'
import type { CampaignType } from './campaigns'
import { DICT_CATEGORIES, DICTIONARIES, type ClassifiedRow, type ReasonKind, type Settings } from './classifier'
import { normalize, PhraseMatcher, tokenize, type Token } from './text'

/**
 * Ограничение Директа на суммарную длину минус-фраз кампании (символов).
 * Если Яндекс поменяет лимит — поправить здесь.
 */
export const DIRECT_MINUS_LIMIT = 20_000

export type CandidateSource = 'rule' | 'frequency' | 'manual'

export type Candidate = {
  /** Уникальный ключ кандидата внутри вида кампании. */
  key: string
  /** Как слово попадёт в список минус-слов. */
  word: string
  /** Почему предложено (для source = 'rule'). */
  kinds: ReasonKind[]
  /** Сколько запросов с этим словом. */
  queries: number
  /** Суммарный расход этих запросов. */
  cost: number
  source: CandidateSource
}

const stopMatcher = new PhraseMatcher<null>().addAll(stopwords, null)

const isStopword = (t: Token) => stopMatcher.match([t]).length > 0
const isNumber = (t: Token) => /^[\d.,/+-]+$/.test(t.text)

/** Ключ для сравнения слов/фраз между собой: основы через пробел. */
export function stemKey(phrase: string): string {
  return tokenize(phrase)
    .map((t) => t.stem)
    .join(' ')
}

function sortCandidates(list: Candidate[]): Candidate[] {
  return list.sort((a, b) => b.cost - a.cost || b.queries - a.queries || a.word.localeCompare(b.word, 'ru'))
}

/** Слова, которые нельзя минусовать в кампании этого вида. */
function protectedMatcher(type: CampaignType, settings: Settings): PhraseMatcher<null> {
  const m = new PhraseMatcher<null>().addAll(settings.whitelist, null).addAll(settings.ownCities, null)
  if (type === 'brand' || type === 'general') m.addAll(settings.brandWords, null)
  if (type === 'competitor' || type === 'general') m.addAll(settings.allowedCompetitors, null)
  return m
}

function isBlocked(phrase: string, protect: PhraseMatcher<null>): boolean {
  const tokens = tokenize(phrase)
  if (tokens.length === 0) return true
  if (protect.match(tokens).length > 0) return true
  return tokens.length === 1 && (isStopword(tokens[0]) || isNumber(tokens[0]))
}

/**
 * Кандидаты по правилам: из 🔴 запросов кампаний этого вида берём слово, на котором сработало
 * правило («бесплатно», чужой бренд, наш бренд в категорийной), а не весь запрос.
 */
export function ruleCandidates(rows: ClassifiedRow[], type: CampaignType, settings: Settings): Candidate[] {
  const protect = protectedMatcher(type, settings)
  const byKey = new Map<string, Candidate>()
  for (const row of rows) {
    if (row.campaignType !== type || row.status !== 'red') continue
    const seenInRow = new Set<string>()
    for (const reason of row.reasons) {
      if (reason.severity !== 'red') continue
      for (const phrase of reason.phrases) {
        const key = stemKey(phrase)
        if (!key || isBlocked(phrase, protect)) continue
        let c = byKey.get(key)
        if (!c) {
          c = { key, word: normalize(phrase), kinds: [], queries: 0, cost: 0, source: 'rule' }
          byKey.set(key, c)
        }
        if (!c.kinds.includes(reason.kind)) c.kinds.push(reason.kind)
        if (!seenInRow.has(key)) {
          seenInRow.add(key)
          c.queries++
          c.cost += row.cost
        }
      }
    }
  }
  return sortCandidates([...byKey.values()])
}

/**
 * Что исключить из частотного анализа, чтобы не дублировать слова, уже найденные правилами.
 * Берём и основы, и сами слова: у «состав» основа «соста», а у «составе» — «состав».
 */
export function ruleExcludeKeys(rule: Candidate[]): Set<string> {
  const keys = new Set<string>()
  for (const c of rule) {
    for (const t of tokenize(c.word)) {
      keys.add(t.stem)
      keys.add(t.text)
    }
  }
  return keys
}

/** Самая частая форма слова среди запросов. */
function topForm(forms: Map<string, number>): string {
  let best = ''
  let bestN = -1
  for (const [f, n] of forms) if (n > bestN || (n === bestN && f.length < best.length)) [best, bestN] = [f, n]
  return best
}

/**
 * Частотный анализ: слова, которые встречаются в 🔴/🟡 запросах кампаний этого вида
 * и ни разу — в 🟢 запросах этого же вида. Помогает найти мусор, которого нет в словарях.
 * `exclude` — ключи уже предложенных слов (по правилам), чтобы не дублировать.
 */
export function frequencyCandidates(
  rows: ClassifiedRow[],
  type: CampaignType,
  settings: Settings,
  exclude: Set<string> = new Set(),
  limit = 300,
): Candidate[] {
  const ofType = rows.filter((r) => r.campaignType === type)
  const green = new Set<string>()
  for (const r of ofType) if (r.status === 'green') for (const t of tokenize(r.query)) green.add(t.stem)

  const protect = protectedMatcher(type, settings)
  const byKey = new Map<string, Candidate & { forms: Map<string, number> }>()
  for (const r of ofType) {
    if (r.status === 'green') continue
    const seen = new Set<string>()
    for (const t of tokenize(r.query)) {
      const key = t.stem
      if (seen.has(key) || green.has(key) || exclude.has(key)) continue
      seen.add(key)
      if (t.text.length < 2 || isStopword(t) || isNumber(t) || protect.match([t]).length > 0) continue
      let c = byKey.get(key)
      if (!c) {
        c = { key, word: t.text, kinds: [], queries: 0, cost: 0, source: 'frequency', forms: new Map() }
        byKey.set(key, c)
      }
      c.queries++
      c.cost += r.cost
      c.forms.set(t.text, (c.forms.get(t.text) ?? 0) + 1)
    }
  }
  const list = [...byKey.values()].map(({ forms, ...c }) => ({ ...c, word: topForm(forms) }))
  return sortCandidates(list).slice(0, limit)
}

export type BrandSuggestion = { key: string; word: string; queries: number; cost: number; example: string }

const allDictionaries = (() => {
  const m = new PhraseMatcher<null>()
  for (const cat of DICT_CATEGORIES) m.addAll(DICTIONARIES[cat], null)
  return m
})()

/**
 * «Похоже на бренды»: слова из запросов, где Директ видит бренд конкурента, а наши списки
 * его не объясняют (причина unknown-brand). Убираем то, что встречается в 🟢 запросах,
 * служебные слова, словарные слова и всё, что уже есть в списках настроек.
 */
export function brandSuggestions(rows: ClassifiedRow[], settings: Settings, limit = 100): BrandSuggestion[] {
  const green = new Set<string>()
  for (const r of rows) if (r.status === 'green') for (const t of tokenize(r.query)) green.add(t.stem)
  const known = new PhraseMatcher<null>()
    .addAll(settings.brandWords, null)
    .addAll(settings.allowedCompetitors, null)
    .addAll(settings.otherCompetitors, null)
    .addAll(settings.extraStores, null)
    .addAll(settings.notBrands, null)
    .addAll(settings.whitelist, null)

  const byKey = new Map<string, BrandSuggestion & { forms: Map<string, number> }>()
  for (const r of rows) {
    if (!r.reasons.some((x) => x.kind === 'unknown-brand')) continue
    const tokens = tokenize(r.query)
    const dictHit = new Set(allDictionaries.match(tokens).flatMap((m) => tokens.slice(m.start, m.end).map((t) => t.stem)))
    const seen = new Set<string>()
    for (const t of tokens) {
      if (seen.has(t.stem)) continue
      seen.add(t.stem)
      if (t.text.length < 2 || green.has(t.stem) || dictHit.has(t.stem) || isStopword(t) || isNumber(t)) continue
      if (known.match([t]).length > 0) continue
      let s = byKey.get(t.stem)
      if (!s) {
        s = { key: t.stem, word: t.text, queries: 0, cost: 0, example: r.query, forms: new Map() }
        byKey.set(t.stem, s)
      }
      s.queries++
      s.cost += r.cost
      s.forms.set(t.text, (s.forms.get(t.text) ?? 0) + 1)
    }
  }
  return [...byKey.values()]
    .map(({ forms, ...s }) => ({ ...s, word: topForm(forms) }))
    .sort((a, b) => b.queries - a.queries || b.cost - a.cost)
    .slice(0, limit)
}

// ---------- Вывод ----------

export type MinusFormat = 'lines' | 'minus'

function fix(phrase: string): string {
  return phrase
    .split(' ')
    .map((w) => (w.startsWith('!') ? w : `!${w}`))
    .join(' ')
}

/**
 * Текст для вставки в Директ.
 * - lines: по одному слову/фразе в строке;
 * - minus: «-бесплатно -скачать» — одиночные слова в одну строку; фразы из нескольких слов
 *   так записать нельзя (минус перед каждым словом расширит минусовку), поэтому они идут
 *   отдельными строками ниже.
 * fixForm — «!» перед каждым словом (зафиксировать словоформу).
 */
export function formatMinusWords(words: string[], format: MinusFormat, fixForm: boolean): string {
  const items = words.map((w) => normalize(w)).filter(Boolean)
  const out = fixForm ? items.map(fix) : items
  if (format === 'lines') return out.join('\n')
  const singles = out.filter((w) => !w.includes(' '))
  const phrasesOut = out.filter((w) => w.includes(' '))
  return [singles.map((w) => `-${w}`).join(' '), ...phrasesOut].filter(Boolean).join('\n')
}

/** Убирает дубли по основам, сохраняя порядок. */
export function dedupeWords(words: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const w of words) {
    const key = stemKey(w)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(normalize(w))
  }
  return result
}
