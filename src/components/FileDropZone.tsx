import { useRef, useState, type DragEvent } from 'react'
import { isSupportedFile, SUPPORTED_EXTENSIONS } from '../lib/file'

type Props = {
  onFile: (file: File) => void
}

const ACCEPT = SUPPORTED_EXTENSIONS.map((ext) => `.${ext}`).join(',')

export function FileDropZone({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFile(file: File | undefined) {
    if (!file) return
    if (!isSupportedFile(file.name)) {
      setError(`Файл «${file.name}» не подходит. Нужен отчёт в формате CSV, TSV или XLSX.`)
      return
    }
    setError(null)
    onFile(file)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
          dragOver
            ? 'border-rose-400 bg-rose-50'
            : 'border-slate-300 bg-white hover:border-rose-300 hover:bg-rose-50/40'
        }`}
      >
        <svg className="h-10 w-10 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        <div className="text-lg font-medium text-slate-800">Перетащите сюда отчёт по поисковым запросам</div>
        <div className="text-sm text-slate-500">
          или <span className="font-medium text-rose-600 underline underline-offset-2">выберите файл</span> · CSV, TSV, XLSX
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
    </div>
  )
}
