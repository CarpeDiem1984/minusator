import { useState } from 'react'
import { DICT_CATEGORIES, REASON_LABELS } from '../lib/classifier'
import type { SettingsForm } from '../lib/settingsForm'

type Props = {
  form: SettingsForm
  onChange: (form: SettingsForm) => void
}

type ListField = 'brandWords' | 'allowedCompetitors' | 'otherCompetitors' | 'extraStores' | 'whitelist' | 'ownCities'

const LIST_FIELDS: { key: ListField; label: string; hint: string; placeholder: string }[] = [
  {
    key: 'brandWords',
    label: 'Слова бренда клиента',
    hint: 'Включая латиницу и частые опечатки. Нужны для правил брендовой, категорийной и конкурентной кампаний.',
    placeholder: 'ониксол, oniksol, ониксал',
  },
  {
    key: 'allowedCompetitors',
    label: 'Разрешённые конкуренты',
    hint: 'Кого разрешил заказчик. В конкурентной и общей кампаниях это не мусор.',
    placeholder: 'микодерил, лоцерил',
  },
  {
    key: 'otherCompetitors',
    label: 'Прочие конкуренты',
    hint: 'Чужие бренды, которые минусуем везде.',
    placeholder: 'фунгистоп, экзодерил',
  },
  {
    key: 'extraStores',
    label: 'Ещё магазины и аптеки',
    hint: 'Если каких-то нет в встроенном словаре магазинов.',
    placeholder: 'аптека от склада',
  },
  {
    key: 'whitelist',
    label: 'Белый список',
    hint: 'Слова, которые никогда не минусуем: запрос с ними максимум 🟡. Бренд сюда не нужен — для него поле выше.',
    placeholder: '',
  },
  {
    key: 'ownCities',
    label: 'Свой город',
    hint: 'Запросы с другими городами станут мусором. Пусто — гео не проверяется.',
    placeholder: 'москва',
  },
]

export function SettingsPanel({ form, onChange }: Props) {
  const [open, setOpen] = useState(true)
  const set = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => onChange({ ...form, [key]: value })

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between">
        <h2 className="font-semibold">Настройки клиента</h2>
        <span className="text-sm text-slate-500">{open ? 'свернуть ▴' : 'развернуть ▾'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            {LIST_FIELDS.map((f) => (
              <label key={f.key} className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">{f.label}</span>
                <textarea
                  rows={2}
                  value={form[f.key]}
                  placeholder={f.placeholder}
                  onChange={(e) => set(f.key, e.target.value)}
                  className="resize-y rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder:text-slate-400"
                />
                <span className="text-xs text-slate-500">{f.hint} Через запятую или с новой строки.</span>
              </label>
            ))}
          </div>

          <div>
            <div className="text-sm font-medium text-slate-700">Что считать мусором во всех кампаниях</div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {DICT_CATEGORIES.map((cat) => (
                <label key={cat} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.categories[cat]}
                    onChange={(e) => set('categories', { ...form.categories, [cat]: e.target.checked })}
                    className="h-4 w-4 accent-rose-600"
                  />
                  {REASON_LABELS[cat]}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-5 text-sm">
            <label className="flex items-center gap-2 text-slate-700">
              🟡 если кликов без конверсий от
              <input
                type="number"
                min={1}
                value={form.minClicks}
                onChange={(e) => set('minClicks', e.target.valueAsNumber)}
                className="w-20 rounded-lg border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-2 text-slate-700">
              или расхода без конверсий от
              <input
                type="number"
                min={1}
                value={form.minCost}
                onChange={(e) => set('minCost', e.target.valueAsNumber)}
                className="w-24 rounded-lg border border-slate-300 px-2 py-1"
              />
              ₽
            </label>
          </div>
        </div>
      )}
    </section>
  )
}
