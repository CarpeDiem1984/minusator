import { describe, expect, it } from 'vitest'
import { parseList, PhraseMatcher, tokenize } from './text'

describe('tokenize', () => {
  it('режет на слова, сохраняя б/у, 18+, дефисы', () => {
    expect(tokenize('Диван  Б/У, санкт-петербург 18+ ёлка!').map((t) => t.text)).toEqual([
      'диван',
      'б/у',
      'санкт-петербург',
      '18+',
      'елка',
    ])
  })
})

describe('parseList', () => {
  it('запятые, точки с запятой, переносы строк; без дублей и пустых', () => {
    expect(parseList('Ониксол, oniksol\n\nониксал; ОНИКСОЛ ')).toEqual(['ониксол', 'oniksol', 'ониксал'])
  })
})

describe('PhraseMatcher', () => {
  const m = new PhraseMatcher<string>()
    .addAll(['бесплатно', 'скачать'], 'free')
    .addAll(['своими руками', 'как сделать'], 'diy')
    .addAll(['отзыв', 'диван', 'ноготь', 'б/у', 'планета здоровья'], 'test')

  const find = (q: string) => m.match(tokenize(q)).map((x) => `${x.payload}:${x.text}`)

  it('ловит разные формы слова', () => {
    expect(find('диван бесплатный')).toEqual(['test:диван', 'free:бесплатный'])
    expect(find('скачала модель')).toEqual(['free:скачала'])
    expect(find('скачать модель')).toEqual(['free:скачать'])
  })

  it('компенсирует слабости стеммера: диваны, отзывы, ногтей', () => {
    expect(find('диваны угловые')).toEqual(['test:диваны'])
    expect(find('диванов много')).toEqual(['test:диванов'])
    expect(find('отзывы покупателей')).toEqual(['test:отзывы'])
    expect(find('отзывов нет')).toEqual(['test:отзывов'])
  })

  it('многословные фразы — подряд и по порядку', () => {
    expect(find('диван своими руками')).toEqual(['test:диван', 'diy:своими руками'])
    expect(find('руками своими')).toEqual([])
    expect(find('как быстро сделать')).toEqual([])
    expect(find('аптека планета здоровья')).toEqual(['test:планета здоровья'])
  })

  it('б/у как отдельное слово', () => {
    expect(find('диван б/у')).toEqual(['test:диван', 'test:б/у'])
  })

  it('не путает похожие слова', () => {
    expect(find('бесплатнее')).toEqual(['free:бесплатнее'])
  })

  it('«работает» ≠ «работа», «самый» ≠ «самостоятельно»', () => {
    const jobs = new PhraseMatcher<string>().addAll(['работа', 'самостоятельно'], 'x')
    expect(jobs.match(tokenize('как работает лосьон'))).toEqual([])
    expect(jobs.match(tokenize('самый лучший лак'))).toEqual([])
    expect(jobs.match(tokenize('работы мастером')).map((x) => x.text)).toEqual(['работы'])
  })

  it('курсы ≠ Курск, курск ≠ курсы', () => {
    const cities = new PhraseMatcher<string>().addAll(['курск'], 'geo')
    const edu = new PhraseMatcher<string>().addAll(['курс'], 'edu')
    expect(cities.match(tokenize('курсы маникюра'))).toEqual([])
    expect(edu.match(tokenize('маникюр курск'))).toEqual([])
    expect(cities.match(tokenize('маникюр в курске')).map((x) => x.text)).toEqual(['курске'])
  })
})
