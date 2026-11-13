const STEPS = [
  {
    title: 'Выгрузите отчёт',
    text: 'В Директе: отчёт «Поисковые запросы» или Мастер отчётов. Формат CSV или XLSX — служебные строки сверху не мешают.',
  },
  {
    title: 'Проверьте мусор',
    text: 'Укажите бренд клиента и конкурентов. Сайт разделит кампании на брендовые, категорийные и конкурентные и подсветит мусор с причиной.',
  },
  {
    title: 'Скопируйте минус-слова',
    text: 'Для каждого вида кампании — свой готовый список. Снимите лишние галочки и вставьте в настройки кампании.',
  },
]

export function HowItWorks() {
  return (
    <section className="mt-8 grid gap-4 sm:grid-cols-3">
      {STEPS.map((s, i) => (
        <div key={s.title} className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-sm font-semibold text-rose-700">
            {i + 1}
          </div>
          <div className="mt-2 font-medium text-slate-900">{s.title}</div>
          <p className="mt-1 text-sm text-slate-600">{s.text}</p>
        </div>
      ))}
    </section>
  )
}
