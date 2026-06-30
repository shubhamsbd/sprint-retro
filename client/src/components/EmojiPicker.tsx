import { useEffect, useRef } from 'react'

interface EmojiPickerProps {
  emojis: readonly string[]
  onSelect: (emoji: string) => void
  onClose: () => void
  className?: string
}

export function EmojiPicker({ emojis, onSelect, onClose, className = '' }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={ref}
      className={`grid grid-cols-6 gap-1 rounded-lg border border-black/10 bg-white p-2 shadow-lg ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {emojis.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => {
            onSelect(emoji)
            onClose()
          }}
          className="rounded-md px-1 py-0.5 text-lg hover:bg-brand-gray"
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
