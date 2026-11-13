import { describe, expect, it } from 'vitest'
import { DEFAULT_FORM } from './settingsForm'
import { clearForm, loadForm, sanitizeForm, saveForm } from './storage'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  }
}

describe('сохранение настроек', () => {
  it('сохраняет и читает обратно', () => {
    const s = memoryStorage()
    const form = {
      ...DEFAULT_FORM,
      brandWords: 'ониксол, oniksol',
      otherCompetitors: 'фунгистоп',
      minCost: 700,
      categories: { ...DEFAULT_FORM.categories, used: false },
    }
    saveForm(form, s)
    expect(loadForm(s)).toEqual(form)
  })

  it('пусто — настройки по умолчанию', () => {
    expect(loadForm(memoryStorage())).toEqual(DEFAULT_FORM)
  })

  it('сломанные данные не ломают сайт', () => {
    const s = memoryStorage()
    s.setItem('minusator.settings.v1', '{не json')
    expect(loadForm(s)).toEqual(DEFAULT_FORM)
  })

  it('хранилище недоступно (приватный режим) — без ошибок', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceeded')
      },
      removeItem: () => {
        throw new Error('SecurityError')
      },
    }
    expect(loadForm(broken)).toEqual(DEFAULT_FORM)
    expect(() => saveForm(DEFAULT_FORM, broken)).not.toThrow()
    expect(() => clearForm(broken)).not.toThrow()
    expect(loadForm(null)).toEqual(DEFAULT_FORM)
  })

  it('clearForm удаляет сохранённое', () => {
    const s = memoryStorage()
    saveForm({ ...DEFAULT_FORM, brandWords: 'x' }, s)
    clearForm(s)
    expect(loadForm(s)).toEqual(DEFAULT_FORM)
  })
})

describe('sanitizeForm', () => {
  it('чужие типы и лишние поля отбрасываются, недостающие — по умолчанию', () => {
    expect(
      sanitizeForm({
        brandWords: 42,
        whitelist: 'бренд',
        minClicks: -1,
        minCost: 'много',
        categories: { free: false, used: 'нет', unknown: true },
        extra: 'мусор',
      }),
    ).toEqual({
      ...DEFAULT_FORM,
      whitelist: 'бренд',
      categories: { ...DEFAULT_FORM.categories, free: false },
    })
  })

  it('старая версия без нового поля notBrands', () => {
    expect(sanitizeForm({ brandWords: 'ониксол' }).notBrands).toBe('')
  })
})
