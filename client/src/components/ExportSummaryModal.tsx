import { useState } from 'react'
import {
  downloadCsvExport,
  downloadMarkdownExport,
  formatExportCsv,
  formatExportSummary,
} from '../lib/export'
import type { ClientRoomState } from '../types'

type ExportFormat = 'markdown' | 'csv'

interface ExportSummaryModalProps {
  room: ClientRoomState
  onClose: () => void
}

export function ExportSummaryModal({ room, onClose }: ExportSummaryModalProps) {
  const [format, setFormat] = useState<ExportFormat>('markdown')
  const [copied, setCopied] = useState(false)

  const markdown = formatExportSummary(room)
  const csv = formatExportCsv(room)
  const preview = format === 'markdown' ? markdown : csv

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(format === 'markdown' ? markdown : csv)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="panel-accent max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="font-semibold text-on-dark">Export summary</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-on-dark">
            ✕
          </button>
        </div>

        <div className="flex gap-2 border-b border-white/10 px-5 py-3">
          <button
            type="button"
            onClick={() => setFormat('markdown')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              format === 'markdown'
                ? 'bg-brand-yellow-light text-brand-black shadow-sm'
                : 'text-muted hover:text-on-dark'
            }`}
          >
            Markdown
          </button>
          <button
            type="button"
            onClick={() => setFormat('csv')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              format === 'csv'
                ? 'bg-brand-yellow-light text-brand-black shadow-sm'
                : 'text-muted hover:text-on-dark'
            }`}
          >
            CSV / Excel
          </button>
        </div>

        <pre className="max-h-96 overflow-auto whitespace-pre-wrap px-5 py-4 text-sm text-zinc-200">
          {preview}
        </pre>

        <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button type="button" onClick={onClose} className="btn-secondary rounded-lg px-4 py-2 text-sm">
            Close
          </button>
          <button type="button" onClick={() => void copyToClipboard()} className="btn-secondary rounded-lg px-4 py-2 text-sm">
            {copied ? 'Copied!' : format === 'markdown' ? 'Copy markdown' : 'Copy CSV'}
          </button>
          {format === 'markdown' ? (
            <button
              type="button"
              onClick={() => downloadMarkdownExport(room)}
              className="btn-primary rounded-lg px-4 py-2 text-sm"
            >
              Download .md
            </button>
          ) : (
            <button
              type="button"
              onClick={() => downloadCsvExport(room)}
              className="btn-primary rounded-lg px-4 py-2 text-sm"
            >
              Download .csv
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
