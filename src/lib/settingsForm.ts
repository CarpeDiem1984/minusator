import { DEFAULT_SETTINGS, type DictCategory, type Settings } from './classifier'
import { parseList } from './text'

/** То, что пользователь вводит в поля настроек (списки — как текст, чтобы можно было печатать запятые). */
export type SettingsForm = {
  brandWords: string
  allowedCompetitors: string
  otherCompetitors: string
  extraStores: string
  whitelist: string
  ownCities: string
  categories: Record<DictCategory, boolean>
  minClicks: number
  minCost: number
}

export const DEFAULT_FORM: SettingsForm = {
  brandWords: '',
  allowedCompetitors: '',
  otherCompetitors: '',
  extraStores: '',
  whitelist: '',
  ownCities: '',
  categories: { ...DEFAULT_SETTINGS.categories },
  minClicks: DEFAULT_SETTINGS.minClicks,
  minCost: DEFAULT_SETTINGS.minCost,
}

export function formToSettings(f: SettingsForm): Settings {
  return {
    brandWords: parseList(f.brandWords),
    allowedCompetitors: parseList(f.allowedCompetitors),
    otherCompetitors: parseList(f.otherCompetitors),
    extraStores: parseList(f.extraStores),
    whitelist: parseList(f.whitelist),
    ownCities: parseList(f.ownCities),
    categories: f.categories,
    minClicks: Number.isFinite(f.minClicks) ? f.minClicks : DEFAULT_SETTINGS.minClicks,
    minCost: Number.isFinite(f.minCost) ? f.minCost : DEFAULT_SETTINGS.minCost,
  }
}
