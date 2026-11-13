/**
 * Русский стеммер — алгоритм Snowball (Porter) для русского языка.
 * https://snowballstem.org/algorithms/russian/stemmer.html
 *
 * Отрезает окончания и суффиксы, чтобы разные формы слова сводились к одной основе:
 * «бесплатно», «бесплатный», «бесплатные» → «бесплатн».
 * Слова не на кириллице (латиница, цифры) возвращаются как есть.
 */

const VOWELS = new Set('аеиоуыэюя')

// Окончания группы 1 должны идти после «а» или «я» (сама буква остаётся).
const PERFECTIVE_GERUND_1 = ['в', 'вши', 'вшись']
const PERFECTIVE_GERUND_2 = ['ив', 'ивши', 'ившись', 'ыв', 'ывши', 'ывшись']
const ADJECTIVE = [
  'ее', 'ие', 'ые', 'ое', 'ими', 'ыми', 'ей', 'ий', 'ый', 'ой', 'ем', 'им', 'ым', 'ом',
  'его', 'ого', 'ему', 'ому', 'их', 'ых', 'ую', 'юю', 'ая', 'яя', 'ою', 'ею',
]
const PARTICIPLE_1 = ['ем', 'нн', 'вш', 'ющ', 'щ']
const PARTICIPLE_2 = ['ивш', 'ывш', 'ующ']
const REFLEXIVE = ['ся', 'сь']
const VERB_1 = ['ла', 'на', 'ете', 'йте', 'ли', 'й', 'л', 'ем', 'н', 'ло', 'но', 'ет', 'ют', 'ны', 'ть', 'ешь', 'нно']
const VERB_2 = [
  'ила', 'ыла', 'ена', 'ейте', 'уйте', 'ите', 'или', 'ыли', 'ей', 'уй', 'ил', 'ыл', 'им', 'ым', 'ен',
  'ило', 'ыло', 'ено', 'ят', 'ует', 'уют', 'ит', 'ыт', 'ены', 'ить', 'ыть', 'ишь', 'ую', 'ю',
]
const NOUN = [
  'а', 'ев', 'ов', 'ие', 'ье', 'е', 'иями', 'ями', 'ами', 'еи', 'ии', 'и', 'ией', 'ей', 'ой', 'ий', 'й',
  'иям', 'ям', 'ием', 'ем', 'ам', 'ом', 'о', 'у', 'ах', 'иях', 'ях', 'ы', 'ь', 'ию', 'ью', 'ю', 'ия', 'ья', 'я',
]
const DERIVATIONAL = ['ост', 'ость']

type Ending = { s: string; group1: boolean }

function endings(group1: string[], group2: string[]): Ending[] {
  return [...group1.map((s) => ({ s, group1: true })), ...group2.map((s) => ({ s, group1: false }))].sort(
    (a, b) => b.s.length - a.s.length,
  )
}

const E_GERUND = endings(PERFECTIVE_GERUND_1, PERFECTIVE_GERUND_2)
const E_ADJECTIVE = endings([], ADJECTIVE)
const E_PARTICIPLE = endings(PARTICIPLE_1, PARTICIPLE_2)
const E_REFLEXIVE = endings([], REFLEXIVE)
const E_VERB = endings(VERB_1, VERB_2)
const E_NOUN = endings([], NOUN)

/**
 * Ищет самое длинное окончание из списка, целиком лежащее в RV, и отрезает его.
 * Как в Snowball: если самое длинное не подошло по условию группы 1 — неудача (без отката к короткому).
 */
function removeEnding(word: string, rv: number, list: Ending[]): string | null {
  for (const { s, group1 } of list) {
    if (!word.endsWith(s) || word.length - s.length < rv) continue
    const cut = word.length - s.length
    if (group1) {
      const prev = word[cut - 1]
      if (cut - 1 < rv || (prev !== 'а' && prev !== 'я')) return null
    }
    return word.slice(0, cut)
  }
  return null
}

function regions(word: string): { rv: number; r2: number } {
  const n = word.length
  let rv = n
  for (let i = 0; i < n; i++) {
    if (VOWELS.has(word[i])) {
      rv = i + 1
      break
    }
  }
  let r1 = n
  for (let i = 1; i < n; i++) {
    if (VOWELS.has(word[i - 1]) && !VOWELS.has(word[i])) {
      r1 = i + 1
      break
    }
  }
  let r2 = n
  for (let i = r1 + 1; i < n; i++) {
    if (VOWELS.has(word[i - 1]) && !VOWELS.has(word[i])) {
      r2 = i + 1
      break
    }
  }
  return { rv, r2 }
}

const CYRILLIC_ONLY = /^[а-я-]+$/

export function stem(input: string): string {
  let word = input.toLowerCase().replace(/ё/g, 'е')
  if (!CYRILLIC_ONLY.test(word)) return word

  const { rv, r2 } = regions(word)

  // Шаг 1
  const gerund = removeEnding(word, rv, E_GERUND)
  if (gerund !== null) {
    word = gerund
  } else {
    word = removeEnding(word, rv, E_REFLEXIVE) ?? word
    const adjective = removeEnding(word, rv, E_ADJECTIVE)
    if (adjective !== null) {
      word = removeEnding(adjective, rv, E_PARTICIPLE) ?? adjective
    } else {
      word = removeEnding(word, rv, E_VERB) ?? removeEnding(word, rv, E_NOUN) ?? word
    }
  }

  // Шаг 2
  if (word.endsWith('и') && word.length - 1 >= rv) word = word.slice(0, -1)

  // Шаг 3
  for (const s of DERIVATIONAL.slice().sort((a, b) => b.length - a.length)) {
    if (word.endsWith(s) && word.length - s.length >= r2) {
      word = word.slice(0, -s.length)
      break
    }
  }

  // Шаг 4
  if ((word.endsWith('ейше') && word.length - 4 >= rv) || (word.endsWith('ейш') && word.length - 3 >= rv)) {
    word = word.slice(0, word.endsWith('ейше') ? -4 : -3)
    if (word.endsWith('нн') && word.length - 2 >= rv) word = word.slice(0, -1)
  } else if (word.endsWith('нн') && word.length - 2 >= rv) {
    word = word.slice(0, -1)
  } else if (word.endsWith('ь') && word.length - 1 >= rv) {
    word = word.slice(0, -1)
  }

  return word
}
