import type { ActivityToast } from '../hooks/useRoomActivity'

interface ActivityToastStackProps {
  toasts: ActivityToast[]
  onDismiss: (id: string) => void
}

export function ActivityToastStack({ toasts, onDismiss }: ActivityToastStackProps) {
  if (toasts.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed bottom-6 right-4 z-50 flex max-w-sm flex-col gap-2 sm:right-6"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="activity-toast pointer-events-auto flex items-start gap-2.5 rounded-xl px-4 py-3"
        >
          <span className="text-lg leading-none">{toast.icon}</span>
          <p className="flex-1 text-sm leading-snug text-brand-black">{toast.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="text-subtle shrink-0 text-xs hover:text-brand-black"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
