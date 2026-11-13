import adult from '../dictionaries/adult.json'
import cities from '../dictionaries/cities.json'
import diy from '../dictionaries/diy.json'
import education from '../dictionaries/education.json'
import free from '../dictionaries/free.json'
import info from '../dictionaries/info.json'
import jobs from '../dictionaries/jobs.json'
import stores from '../dictionaries/stores.json'
import used from '../dictionaries/used.json'
import type { CampaignType } from './campaigns'
import type { QueryRow } from './parser'
import { normalize, PhraseMatcher, tokenize, type PhraseMatch } from './text'

// ---------- Словари ----------

export type DictCategory = 'free' | 'jobs' | 'diy' | 'info' | 'education' | 'used' | 'adult' | 'stores'

export const DICT_CATEGORIES: DictCategory[] = ['free', 'jobs', 'diy', 'info', 'education', 'used', 'adult', 'stores']

export const DICTIONARIES: Record<DictCategory, string[]> = {
  free,
  jobs,
  diy,
  info,
  education,
  used,
  adult,
  stores,
}

// ---------- Настройки ----------

export type Settings = {
  /** Слова бренда клиента (ониксол, oniksol, ониксал). */
  brandWords: string[]
  /** Конкуренты, которых разрешил заказчик (ок в конкурентной и общей кампаниях). */
  allowedCompetitors: string[]
  /** Остальные конкуренты — мусор в любой кампании. */
  otherCompetitors: string[]
  /** Дополнительные магазины/аптеки сверх словаря stores.json. */
  extraStores: string[]
  /** Слова, из-за которых запрос не становится 🔴 (максимум 🟡). */
  whitelist: string[]
  /** Свой город (или несколько). Пусто — гео-правило выключено. */
  ownCities: string[]
  /** Слова, которые пользователь отметил «не бренд» (не предлагать в «Похоже на бренды»). */
  notBrands: string[]
  /** Какие словари включены. */
  categories: Record<DictCategory, boolean>
  /** Порог кликов без конверсий для 🟡. */
  minClicks: number
  /** Порог расхода без конверсий для 🟡. */
  minCost: number
}

export const DEFAULT_SETTINGS: Settings = {
  brandWords: [],
  allowedCompetitors: [],
  otherCompetitors: [],
  extraStores: [],
  whitelist: [],
  ownCities: [],
  notBrands: [],
  categories: { free: true, jobs: true, diy: true, info: true, education: true, used: true, adult: true, stores: true },
  minClicks: 5,
  minCost: 500,
}

// ---------- Результат ----------

export type Status = 'red' | 'yellow' | 'green'

export type ReasonKind =
  | DictCategory
  | 'competitor'
  | 'own-brand'
  | 'no-brand'
  | 'geo'
  | 'unknown-brand'
  | 'metric-clicks'
  | 'metric-cost'
  | 'whitelist'

export type Reason = {
  kind: ReasonKind
  /** red — делает запрос мусором; yellow — подозрение; info — пояснение (белый список). */
  severity: 'red' | 'yellow' | 'info'
  /** Слова из запроса, на которых сработало правило (как они написаны в запросе). */
  words: string[]
  /** Те же совпадения в форме из словаря/настроек («отзывы», «фунгистоп») — из них собираются минус-слова. */
  phrases: string[]
}

export type Classification = { status: Status; reasons: Reason[] }

export type ClassifiedRow = QueryRow & Classification & { campaignType: CampaignType }

export const REASON_LABELS: Record<ReasonKind, string> = {
  free: 'Бесплатное',
  jobs: 'Работа, вакансии',
  diy: 'Своими руками',
  info: 'Информационный',
  education: 'Обучение',
  used: 'Б/у',
  adult: '18+',
  stores: 'Магазин / аптека',
  competitor: 'Конкурент',
  'own-brand': 'Наш бренд не в брендовой',
  'no-brand': 'Нет бренда в брендовой',
  geo: 'Чужой город',
  'unknown-brand': 'Похоже на чужой бренд',
  'metric-clicks': 'Кликают без конверсий',
  'metric-cost': 'Расход без конверсий',
  whitelist: 'Белый список',
}

/** Какие колонки есть в отчёте — метрические правила работают только при их наличии. */
export type Available = {
  clicks: boolean
  cost: boolean
  conversions: boolean
  brandMention: boolean
}

// ---------- Гео ----------

/** Разные названия одного города: если свой город — Санкт-Петербург, «спб» и «питер» не чужие. */
const CITY_ALIASES: string[][] = [
  ['москва', 'мск'],
  ['санкт-петербург', 'спб', 'питер', 'петербург'],
  ['нижний новгород', 'нн'],
  ['екатеринбург', 'екб'],
  ['ростов', 'ростов-на-дону'],
]

function buildGeoMatcher(ownCities: string[]): PhraseMatcher<null> | null {
  if (ownCities.length === 0) return null
  const own = new PhraseMatcher<null>().addAll(ownCities, null)
  const isOwn = (city: string) => {
    const t = tokenize(city)
    if (own.match(t).length > 0) return true
    const group = CITY_ALIASES.find((g) => g.includes(normalize(city)))
    return group ? group.some((alias) => own.match(tokenize(alias)).length > 0) : false
  }
  return new PhraseMatcher<null>().addAll(
    cities.filter((c) => !isOwn(c)),
    null,
  )
}

// ---------- Классификатор ----------

type Matches = PhraseMatch<unknown>[]
const words = (matches: Matches) => [...new Set(matches.map((m) => m.text))]
/**
 * Форма из словаря для каждого совпавшего куска запроса. Если на одно место запроса совпало
 * несколько записей словаря («бесплатно» и «бесплатный»), берём одну: ту, что совпадает с запросом
 * буква в букву, иначе первую по словарю.
 */
const phrases = (matches: Matches) => {
  const bySpan = new Map<string, PhraseMatch<unknown>>()
  for (const m of matches) {
    const span = `${m.start}:${m.end}`
    const prev = bySpan.get(span)
    if (!prev || (m.phrase === m.text && prev.phrase !== prev.text)) bySpan.set(span, m)
  }
  return [...new Set([...bySpan.values()].map((m) => m.phrase))]
}

/**
 * Готовит классификатор под настройки (словари компилируются один раз),
 * возвращает функцию, которая оценивает один запрос в кампании заданного вида.
 */
export function createClassifier(settings: Settings, available: Available) {
  const brand = new PhraseMatcher<null>().addAll(settings.brandWords, null)
  const allowed = new PhraseMatcher<null>().addAll(settings.allowedCompetitors, null)
  // если конкурент попал в оба списка — считаем его разрешённым
  const allowedSet = new Set(settings.allowedCompetitors.map(normalize))
  const other = new PhraseMatcher<null>().addAll(
    settings.otherCompetitors.filter((c) => !allowedSet.has(normalize(c))),
    null,
  )
  const storeMatcher = new PhraseMatcher<null>().addAll(settings.extraStores, null)
  if (settings.categories.stores) storeMatcher.addAll(DICTIONARIES.stores, null)

  const dict = new PhraseMatcher<DictCategory>()
  for (const cat of DICT_CATEGORIES) {
    if (cat !== 'stores' && settings.categories[cat]) dict.addAll(DICTIONARIES[cat], cat)
  }
  const whitelist = new PhraseMatcher<null>().addAll(settings.whitelist, null)
  const geo = buildGeoMatcher(settings.ownCities)
  const hasBrandWords = settings.brandWords.length > 0

  return function classify(row: QueryRow, type: CampaignType): Classification {
    const tokens = tokenize(row.query)
    const reasons: Reason[] = []
    const red = (kind: ReasonKind, m: Matches) =>
      reasons.push({ kind, severity: 'red', words: words(m), phrases: phrases(m) })
    const yellow = (kind: ReasonKind) => reasons.push({ kind, severity: 'yellow', words: [], phrases: [] })

    const brandM = brand.match(tokens)
    const allowedM = allowed.match(tokens)
    const otherM = other.match(tokens)
    const storeM = storeMatcher.match(tokens)

    // 1. Правила по видам кампаний
    if ((type === 'category' || type === 'competitor') && brandM.length > 0) red('own-brand', brandM)
    if (type === 'brand' && hasBrandWords && brandM.length === 0) red('no-brand', [])

    const competitorM = type === 'brand' || type === 'category' ? [...otherM, ...allowedM] : otherM
    if (competitorM.length > 0) red('competitor', competitorM)

    if (storeM.length > 0) red('stores', storeM)

    // 2. Словари
    const dictM = dict.match(tokens)
    for (const cat of DICT_CATEGORIES) {
      const m = dictM.filter((x) => x.payload === cat)
      if (m.length > 0) red(cat, m)
    }

    // 3. Гео
    if (geo) {
      const geoM = geo.match(tokens)
      if (geoM.length > 0) red('geo', geoM)
    }

    // Неизвестный бренд: Директ видит в запросе конкурента, а наши списки его не объясняют
    if (
      available.brandMention &&
      row.brandMention.toLowerCase().includes('конкурент') &&
      allowedM.length === 0 &&
      otherM.length === 0 &&
      storeM.length === 0
    ) {
      yellow('unknown-brand')
    }

    // 5. Метрики
    if (available.conversions && row.conversions === 0) {
      if (available.clicks && row.clicks >= settings.minClicks) yellow('metric-clicks')
      if (available.cost && row.cost >= settings.minCost) yellow('metric-cost')
    }

    // 4. Белый список и итоговый статус
    const hasRed = reasons.some((r) => r.severity === 'red')
    const whiteM = whitelist.match(tokens)
    if (hasRed && whiteM.length > 0) {
      reasons.push({ kind: 'whitelist', severity: 'info', words: words(whiteM), phrases: phrases(whiteM) })
      return { status: 'yellow', reasons }
    }
    if (hasRed) return { status: 'red', reasons }
    if (reasons.length > 0) return { status: 'yellow', reasons }
    return { status: 'green', reasons }
  }
}

/** Оценивает все запросы отчёта. Вид кампании берётся из campaignTypes (по умолчанию — общая). */
export function classifyRows(
  rows: QueryRow[],
  campaignTypes: Record<string, CampaignType>,
  settings: Settings,
  available: Available,
): ClassifiedRow[] {
  const classify = createClassifier(settings, available)
  return rows.map((row) => {
    const campaignType = campaignTypes[row.campaign] ?? 'general'
    return { ...row, campaignType, ...classify(row, campaignType) }
  })
}

/** «Бесплатное: бесплатно, скачать» */
export function describeReason(r: Reason): string {
  const label = REASON_LABELS[r.kind]
  return r.words.length > 0 ? `${label}: ${r.words.join(', ')}` : label
}
