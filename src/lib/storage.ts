import { DICT_CATEGORIES } from './classifier'
import { DEFAULT_FORM, type SettingsForm } from './settingsForm'

const KEY = 'minusator.settings.v1'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** localStorage может быть недоступен (приватный режим, запрет cookies) — тогда просто не сохраняем. */
function getStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback)
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback)

/** Берём из сохранённого только то, что выглядит правильно; остальное — по умолчанию. */
export function sanitizeForm(raw: unknown): SettingsForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const cats = (r.categories && typeof r.categories === 'object' ? r.categories : {}) as Record<string, unknown>
  const categories = { ...DEFAULT_FORM.categories }
  for (const c of DICT_CATEGORIES) if (typeof cats[c] === 'boolean') categories[c] = cats[c] as boolean
  return {
    brandWords: str(r.brandWords, DEFAULT_FORM.brandWords),
    allowedCompetitors: str(r.allowedCompetitors, DEFAULT_FORM.allowedCompetitors),
    otherCompetitors: str(r.otherCompetitors, DEFAULT_FORM.otherCompetitors),
    extraStores: str(r.extraStores, DEFAULT_FORM.extraStores),
    whitelist: str(r.whitelist, DEFAULT_FORM.whitelist),
    ownCities: str(r.ownCities, DEFAULT_FORM.ownCities),
    notBrands: str(r.notBrands, DEFAULT_FORM.notBrands),
    categories,
    minClicks: num(r.minClicks, DEFAULT_FORM.minClicks),
    minCost: num(r.minCost, DEFAULT_FORM.minCost),
  }
}

export function loadForm(storage: StorageLike | null = getStorage()): SettingsForm {
  try {
    const raw = storage?.getItem(KEY)
    return raw ? sanitizeForm(JSON.parse(raw)) : DEFAULT_FORM
  } catch {
    return DEFAULT_FORM
  }
}

export function saveForm(form: SettingsForm, storage: StorageLike | null = getStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(form))
  } catch {
    // нет места или запрещено — не страшно, просто не запомним
  }
}

export function clearForm(storage: StorageLike | null = getStorage()): void {
  try {
    storage?.removeItem(KEY)
  } catch {
    // ничего
  }
}
