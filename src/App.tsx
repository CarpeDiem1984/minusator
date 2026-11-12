import { useState } from 'react'
import { FileDropZone } from './components/FileDropZone'
import { formatFileSize } from './lib/file'

export default function App() {
  const [file, setFile] = useState<File | null>(null)

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:py-16">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Минус<span className="text-rose-600">атор</span>
          </h1>
          <p className="mt-2 text-slate-600">
            Загрузите отчёт по поисковым запросам Яндекс Директа — найдём мусорные запросы и соберём список
            минус-слов.
          </p>
        </header>

        <FileDropZone onFile={setFile} />

        {file && (
          <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
            <div className="min-w-0">
              <div className="truncate font-medium">{file.name}</div>
              <div className="text-sm text-slate-500">{formatFileSize(file.size)} · файл загружен</div>
            </div>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Убрать
            </button>
          </div>
        )}
      </main>

      <footer className="px-4 py-6 text-center text-sm text-slate-500">
        🔒 Файлы обрабатываются в вашем браузере и никуда не отправляются.
      </footer>
    </div>
  )
}
