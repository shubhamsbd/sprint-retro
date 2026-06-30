import { useEffect, useRef, useState } from 'react'
import { PHASE_LABELS, type ClientRoomState } from '../types'

export interface ActivityToast {
  id: string
  icon: string
  message: string
}

const TOAST_TTL_MS = 4500

function findColumnLabel(room: ClientRoomState, columnId: string): string {
  return room.columns.find((c) => c.id === columnId)?.label ?? 'a column'
}

function participantName(room: ClientRoomState, participantId: string): string {
  if (participantId === room.you.id) return 'You'
  return room.participants.find((p) => p.id === participantId)?.name ?? 'Someone'
}

export function useRoomActivity(room: ClientRoomState) {
  const [toasts, setToasts] = useState<ActivityToast[]>([])
  const snapshotRef = useRef<{
    phase: ClientRoomState['phase']
    cardIds: Set<string>
    participantIds: Set<string>
  } | null>(null)
  const toastCounter = useRef(0)

  useEffect(() => {
    const snapshot = {
      phase: room.phase,
      cardIds: new Set(room.cards.map((c) => c.id)),
      participantIds: new Set(room.participants.map((p) => p.id)),
    }

    if (!snapshotRef.current) {
      snapshotRef.current = snapshot
      return
    }

    const prev = snapshotRef.current
    const messages: ActivityToast[] = []

    if (room.phase !== prev.phase) {
      messages.push({
        id: `phase-${++toastCounter.current}`,
        icon: '🔄',
        message: `Phase changed to ${PHASE_LABELS[room.phase]}`,
      })
    }

    for (const participant of room.participants) {
      if (!prev.participantIds.has(participant.id) && participant.id !== room.you.id) {
        messages.push({
          id: `join-${participant.id}-${++toastCounter.current}`,
          icon: '👋',
          message: `${participant.name} joined the retro`,
        })
      }
    }

    for (const card of room.cards) {
      if (!prev.cardIds.has(card.id)) {
        const author = participantName(room, card.authorId)
        const column = findColumnLabel(room, card.columnId)
        const prefix = card.authorId === room.you.id ? 'You' : author
        const verb = card.authorId === room.you.id ? 'added a card to' : 'added a note in'
        messages.push({
          id: `card-${card.id}-${++toastCounter.current}`,
          icon: '📌',
          message: `${prefix} ${verb} ${column}`,
        })
      }
    }

    snapshotRef.current = snapshot

    if (messages.length === 0) return

    setToasts((current) => [...current, ...messages].slice(-4))

    const timer = window.setTimeout(() => {
      setToasts((current) => current.filter((t) => !messages.some((m) => m.id === t.id)))
    }, TOAST_TTL_MS)

    return () => window.clearTimeout(timer)
  }, [room])

  function dismissToast(id: string) {
    setToasts((current) => current.filter((t) => t.id !== id))
  }

  return { toasts, dismissToast }
}
