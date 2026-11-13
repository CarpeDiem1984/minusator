import { useState } from 'react'
import { formatMoney, formatNumber } from '../lib/format'
import type { BrandSuggestion } from '../lib/minus'

export type BrandMark = 'competitor' | 'store' | 'not-brand'

type Props = {
  suggestions: BrandSuggestion[]
  onMark: (word: string, mark: BrandMark) => void
}

const PAGE = 20

export function BrandSuggestions({ suggestions, onMark }: Props) {
  const [limit, setLimit] = useState(PAGE)
  if (suggestions.length === 0) return null

  const btn = 'rounded-md border px-2 py-0.5 text-xs whitespace-nowrap'
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <h2 className="font-semibold">Похоже на бренды</h2>
      <p className="mt-1 text-sm text-slate-500">
        В этих запросах Директ видит бренд конкурента, а в ваших списках его нет. Отметьте, что это за слово: оно
        попадёт в настройки, и статусы пересчитаются.
      </p>
      <ul className="mt-3 divide-y divide-slate-100">
        {suggestions.slice(0, limit).map((s) => (
          <li key={s.key} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <span className="font-medium text-slate-900">{s.word}</span>
              <span className="ml-2 text-xs text-slate-500">
                запросов: {formatNumber(s.queries)} · {formatMoney(s.cost)}
              </span>
              <div className="truncate text-xs text-slate-400">например: {s.example}</div>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() => onMark(s.word, 'competitor')}
                className={`${btn} border-rose-300 text-rose-700 hover:bg-rose-50`}
              >
                конкурент
              </button>
              <button
                type="button"
                onClick={() => onMark(s.word, 'store')}
                className={`${btn} border-amber-300 text-amber-700 hover:bg-amber-50`}
              >
                магазин
              </button>
              <button
                type="button"
                onClick={() => onMark(s.word, 'not-brand')}
                className={`${btn} border-slate-300 text-slate-600 hover:bg-slate-50`}
              >
                не бренд
              </button>
            </div>
          </li>
        ))}
      </ul>
      {suggestions.length > limit && (
        <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="mt-2 text-sm text-slate-600 hover:text-slate-900">
          Показать ещё (осталось {formatNumber(suggestions.length - limit)})
        </button>
      )}
    </section>
  )
}
