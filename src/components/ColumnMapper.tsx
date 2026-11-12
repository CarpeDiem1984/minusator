import { FIELDS, FIELD_LABELS, type ColumnMapping, type Field } from '../lib/parser'

type Props = {
  headers: string[]
  /** Первая строка данных — чтобы показать пример значения рядом с названием колонки. */
  example?: string[]
  mapping: ColumnMapping
  onChange: (mapping: ColumnMapping) => void
}

function optionLabel(header: string, index: number, example?: string): string {
  const name = header || `Колонка ${index + 1}`
  if (!example) return name
  const short = example.length > 30 ? `${example.slice(0, 30)}…` : example
  return `${name} — например, «${short}»`
}

/** Ручной выбор: какая колонка файла — запрос, какая — клики и т. д. */
export function ColumnMapper({ headers, example, mapping, onChange }: Props) {
  function setField(field: Field, value: string) {
    const next: ColumnMapping = { ...mapping }
    if (value === '') {
      delete next[field]
    } else {
      const idx = Number(value)
      // одна колонка — одно поле: если колонку уже выбрали для другого поля, снимаем там
      for (const f of FIELDS) if (next[f] === idx) delete next[f]
      next[field] = idx
    }
    onChange(next)
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {FIELDS.map((field) => (
        <label key={field} className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">
            {FIELD_LABELS[field]}
            {field === 'query' && <span className="text-rose-600"> *</span>}
          </span>
          <select
            value={mapping[field] ?? ''}
            onChange={(e) => setField(field, e.target.value)}
            className={`rounded-lg border bg-white px-2 py-1.5 text-slate-800 ${
              field === 'query' && mapping.query === undefined ? 'border-rose-400' : 'border-slate-300'
            }`}
          >
            <option value="">— нет в файле —</option>
            {headers.map((h, i) => (
              <option key={i} value={i}>
                {optionLabel(h, i, example?.[i])}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  )
}
