import { stem } from './stemmer'

/** Нижний регистр, ё → е, лишние пробелы убраны. */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
}

export type Token = {
  /** Слово как в запросе (в нижнем регистре, ё → е). */
  text: string
  /** Основа слова. */
  stem: string
}

// Слова: буквы/цифры, внутри можно «/», «-», «+», «.» (б/у, санкт-петербург, 18+, ozon.ru)
const WORD = /[a-zа-я0-9]+(?:[/\-+.][a-zа-я0-9]+)*\+?/g

const stemCache = new Map<string, string>()

/** Основа слова с кэшем — в отчёте на 60 000 строк слова сильно повторяются. */
export function cachedStem(word: string): string {
  let s = stemCache.get(word)
  if (s === undefined) {
    s = stem(word)
    stemCache.set(word, s)
  }
  return s
}

export function tokenize(text: string): Token[] {
  const words = normalize(text).match(WORD) ?? []
  return words.map((w) => ({ text: w, stem: cachedStem(w) }))
}

/** Разбор строки списка из настроек: «ониксол, oniksol\nониксал» → ['ониксол', 'oniksol', 'ониксал']. */
export function parseList(input: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const part of input.split(/[,;\n]/)) {
    const item = normalize(part)
    if (item && !seen.has(item)) {
      seen.add(item)
      result.push(item)
    }
  }
  return result
}

type Entry<T> = {
  phrase: string
  /** Слова фразы как есть (нормализованные). */
  words: string[]
  stems: string[]
  /** Можно ли сравнивать основу слова запроса с самим словом (см. wordMatches). */
  rawOk: boolean[]
  payload: T
}

/** Слово без окончания — кончается на согласную (диван, отзыв, курс). */
const ENDS_WITH_CONSONANT = /[бвгджзклмнпрстфхцчшщ]$/


export type PhraseMatch<T> = {
  phrase: string
  payload: T
  /** Как совпавший кусок выглядит в самом запросе: «бесплатные». */
  text: string
  start: number
  end: number
}

/**
 * Совпадает ли слово запроса со словом из словаря.
 * Сравниваем основу слова запроса и с основой, и с самим словом из словаря:
 * Snowball иногда режет лишнее («диван» → «дива», «отзыв» → «отз»), а у других форм
 * основа получается полной («диванов» → «диван», «отзывы» → «отзыв»).
 * Только для слов на согласную: у «работа» окончание настоящее, и иначе
 * «работает» (основа «работа») совпало бы с «работа».
 */
function wordMatches(token: Token, word: string, wordStem: string, rawOk: boolean): boolean {
  return token.stem === wordStem || token.text === word || (rawOk && token.stem === word)
}

/**
 * Поиск фраз из словаря в запросе. Многословные фразы («своими руками»)
 * ищутся как идущие подряд слова в том же порядке, по основам.
 */
export class PhraseMatcher<T> {
  private index = new Map<string, Entry<T>[]>()

  add(phrase: string, payload: T): void {
    const tokens = tokenize(phrase)
    if (tokens.length === 0) return
    const entry: Entry<T> = {
      phrase: normalize(phrase),
      words: tokens.map((t) => t.text),
      stems: tokens.map((t) => t.stem),
      rawOk: tokens.map((t) => ENDS_WITH_CONSONANT.test(t.text)),
      payload,
    }
    for (const key of new Set([entry.stems[0], entry.words[0]])) {
      const list = this.index.get(key)
      if (list) list.push(entry)
      else this.index.set(key, [entry])
    }
  }

  addAll(phrases: string[], payload: T): this {
    for (const p of phrases) this.add(p, payload)
    return this
  }

  get size(): number {
    return this.index.size
  }

  match(tokens: Token[]): PhraseMatch<T>[] {
    const result: PhraseMatch<T>[] = []
    for (let i = 0; i < tokens.length; i++) {
      const candidates = new Set([...(this.index.get(tokens[i].stem) ?? []), ...(this.index.get(tokens[i].text) ?? [])])
      for (const e of candidates) {
        const end = i + e.words.length
        if (end > tokens.length) continue
        let ok = true
        for (let k = 0; k < e.words.length; k++) {
          if (!wordMatches(tokens[i + k], e.words[k], e.stems[k], e.rawOk[k])) {
            ok = false
            break
          }
        }
        if (ok) {
          result.push({
            phrase: e.phrase,
            payload: e.payload,
            text: tokens
              .slice(i, end)
              .map((t) => t.text)
              .join(' '),
            start: i,
            end,
          })
        }
      }
    }
    return result
  }
}
