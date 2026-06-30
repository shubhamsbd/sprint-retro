import { useEffect } from 'react'

interface ConfirmModalProps {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="panel-accent w-full max-w-md rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-black/8 px-5 py-4">
          <h2 id="confirm-modal-title" className="font-semibold text-brand-black">
            {title}
          </h2>
        </div>

        <p id="confirm-modal-message" className="px-5 py-4 text-sm leading-relaxed text-muted">
          {message}
        </p>

        <div className="flex justify-end gap-2 border-t border-black/8 px-5 py-4">
          <button type="button" onClick={onCancel} className="btn-secondary rounded-xl px-4 py-2 text-sm">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
