import { useCallback, useEffect, useRef, useState } from 'react'
import type { Avatar } from '../lib/avatars'
import { clearRoomSession, loadRoomSession, saveRoomSession } from '../lib/roomSession'
import { clearInvitePath, parseInviteRoomId, setInvitePath } from '../lib/urls'
import { avatarForSession, saveCustomizedAvatar, saveName } from '../lib/userProfile'
import type { ClientRoomState, ColumnId, RetroPhase, SessionPayload } from '../types'
import { normalizeRoomState } from '../types'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string }

async function postJson<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return (await response.json()) as ApiResponse<T>
  } catch {
    return { ok: false, error: 'Network error' }
  }
}

export function useRetroRoom() {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [room, setRoom] = useState<ClientRoomState | null>(null)
  const [inviteRoomId, setInviteRoomId] = useState<string | null>(() => parseInviteRoomId())
  const [restoringSession, setRestoringSession] = useState(() => {
    const urlRoomId = parseInviteRoomId()
    const saved = loadRoomSession()
    return Boolean(saved && (!urlRoomId || urlRoomId === saved.roomId))
  })
  const eventSourceRef = useRef<EventSource | null>(null)
  const sessionRef = useRef<{ roomId: string; participantId: string } | null>(null)
  const restoringRef = useRef(restoringSession)

  useEffect(() => {
    function syncInviteFromUrl() {
      setInviteRoomId(parseInviteRoomId())
    }
    window.addEventListener('popstate', syncInviteFromUrl)
    return () => window.removeEventListener('popstate', syncInviteFromUrl)
  }, [])

  const closeStream = useCallback(() => {
    eventSourceRef.current?.close()
    eventSourceRef.current = null
  }, [])

  const handleRoomClosed = useCallback(
    (message: string) => {
      closeStream()
      sessionRef.current = null
      clearRoomSession()
      setRoom(null)
      clearInvitePath()
      setInviteRoomId(null)
      setRestoringSession(false)
      setError(message)
    },
    [closeStream],
  )

  const finishRestore = useCallback(() => {
    restoringRef.current = false
    setRestoringSession(false)
    clearRoomSession()
  }, [])

  const subscribe = useCallback(
    (roomId: string, participantId: string) => {
      closeStream()
      const session = { roomId: roomId.trim().toUpperCase(), participantId }
      sessionRef.current = session
      saveRoomSession(session)
      setInvitePath(session.roomId)

      const stream = new EventSource(
        `${API_BASE}/api/rooms/${encodeURIComponent(session.roomId)}/stream?participantId=${encodeURIComponent(participantId)}`,
      )

      stream.addEventListener('room:state', (event) => {
        restoringRef.current = false
        setRestoringSession(false)
        setRoom(normalizeRoomState(JSON.parse(event.data) as ClientRoomState))
        setError(null)
        setConnected(true)
      })

      stream.addEventListener('room:closed', (event) => {
        const { message } = JSON.parse(event.data) as { message: string }
        handleRoomClosed(message)
      })

      stream.onerror = () => {
        setConnected(false)
        if (restoringRef.current) {
          finishRestore()
        }
      }

      eventSourceRef.current = stream
    },
    [closeStream, finishRestore, handleRoomClosed],
  )

  useEffect(() => {
    const urlRoomId = parseInviteRoomId()
    const saved = loadRoomSession()
    if (!saved) {
      setRestoringSession(false)
      return
    }
    if (urlRoomId && urlRoomId !== saved.roomId) {
      clearRoomSession()
      setRestoringSession(false)
      return
    }

    restoringRef.current = true
    setRestoringSession(true)
    subscribe(saved.roomId, saved.participantId)
  }, [subscribe])

  useEffect(() => {
    let cancelled = false

    async function checkHealth() {
      try {
        const response = await fetch(`${API_BASE}/api/health`)
        if (!cancelled) setConnected(response.ok)
      } catch {
        if (!cancelled) setConnected(false)
      }
    }

    checkHealth()
    const interval = setInterval(checkHealth, 30000)

    return () => {
      cancelled = true
      clearInterval(interval)
      closeStream()
    }
  }, [closeStream])

  const createRoom = useCallback(
    async (
      name: string,
      passwordProtected: boolean,
      password?: string,
      roomId?: string,
      title?: string,
    ) => {
      const trimmedName = name.trim()
      const avatar = avatarForSession(trimmedName)

      const result = await postJson<SessionPayload>('/api/rooms/create', {
        name: trimmedName,
        passwordProtected,
        password: passwordProtected ? password : undefined,
        roomId: roomId?.trim() || undefined,
        title: title?.trim() || undefined,
        avatar,
      })

      if (!result.ok) {
        setError(result.error)
        return false
      }

      saveName(trimmedName)
      setRoom(normalizeRoomState(result.data.state))
      subscribe(result.data.roomId, result.data.participantId)
      setConnected(true)
      setInviteRoomId(null)
      return true
    },
    [subscribe],
  )

  const joinRoom = useCallback(
    async (roomId: string, name: string, password?: string) => {
      const trimmedName = name.trim()
      const avatar = avatarForSession(trimmedName)

      const result = await postJson<SessionPayload>('/api/rooms/join', {
        roomId: roomId.trim().toUpperCase(),
        name: trimmedName,
        password: password?.trim() || undefined,
        avatar,
      })

      if (!result.ok) {
        setError(result.error)
        return false
      }

      saveName(trimmedName)
      setRoom(normalizeRoomState(result.data.state))
      subscribe(result.data.roomId, result.data.participantId)
      setConnected(true)
      return true
    },
    [subscribe],
  )

  const withSession = useCallback(
    async (action: string, body: Record<string, unknown> = {}) => {
      const session = sessionRef.current
      if (!session) return

      await postJson(`/api/rooms/${encodeURIComponent(session.roomId)}/${action}`, {
        participantId: session.participantId,
        ...body,
      })
    },
    [],
  )

  const addCard = useCallback(
    (columnId: ColumnId, text: string, emoji?: string) => {
      void withSession('add-card', { columnId, text, emoji })
    },
    [withSession],
  )

  const updateCard = useCallback(
    (cardId: string, text: string, emoji?: string | null) => {
      void withSession('update-card', { cardId, text, emoji })
    },
    [withSession],
  )

  const deleteCard = useCallback(
    (cardId: string) => {
      void withSession('delete-card', { cardId })
    },
    [withSession],
  )

  const moveCard = useCallback(
    (cardId: string, columnId: ColumnId) => {
      void withSession('move-card', { cardId, columnId })
    },
    [withSession],
  )

  const voteCard = useCallback(
    (cardId: string) => {
      void withSession('vote-card', { cardId })
    },
    [withSession],
  )

  const unvoteCard = useCallback(
    (cardId: string) => {
      void withSession('unvote-card', { cardId })
    },
    [withSession],
  )

  const groupCards = useCallback(
    (cardIds: string[]) => {
      void withSession('group-cards', { cardIds })
    },
    [withSession],
  )

  const ungroupCard = useCallback(
    (cardId: string) => {
      void withSession('ungroup-card', { cardId })
    },
    [withSession],
  )

  const addColumn = useCallback(
    (label: string) => {
      void withSession('add-column', { label })
    },
    [withSession],
  )

  const removeColumn = useCallback(
    (columnId: string) => {
      void withSession('remove-column', { columnId })
    },
    [withSession],
  )

  const renameColumn = useCallback(
    (columnId: string, label: string) => {
      void withSession('rename-column', { columnId, label })
    },
    [withSession],
  )

  const updateTitle = useCallback(
    (title: string) => {
      void withSession('update-title', { title })
    },
    [withSession],
  )

  const toggleReaction = useCallback(
    (cardId: string, emoji: string) => {
      void withSession('toggle-reaction', { cardId, emoji })
    },
    [withSession],
  )

  const addComment = useCallback(
    (cardId: string, text: string, parentId?: string | null) => {
      void withSession('add-comment', { cardId, text, parentId: parentId ?? null })
    },
    [withSession],
  )

  const toggleCommentLike = useCallback(
    (cardId: string, commentId: string) => {
      void withSession('toggle-comment-like', { cardId, commentId })
    },
    [withSession],
  )

  const toggleCommentReaction = useCallback(
    (cardId: string, commentId: string, emoji: string) => {
      void withSession('toggle-comment-reaction', { cardId, commentId, emoji })
    },
    [withSession],
  )

  const deleteComment = useCallback(
    (cardId: string, commentId: string) => {
      void withSession('delete-comment', { cardId, commentId })
    },
    [withSession],
  )

  const setPhase = useCallback(
    (phase: RetroPhase) => {
      void withSession('set-phase', { phase })
    },
    [withSession],
  )

  const startTimer = useCallback(
    (durationSec: number) => {
      void withSession('start-timer', { durationSec })
    },
    [withSession],
  )

  const stopTimer = useCallback(() => {
    void withSession('stop-timer')
  }, [withSession])

  const assignFacilitator = useCallback(
    (facilitatorId: string) => {
      void withSession('assign-facilitator', { facilitatorId })
    },
    [withSession],
  )

  const updateAvatar = useCallback(
    async (avatar: Avatar, displayName: string) => {
      await withSession('avatar', { avatar })
      saveCustomizedAvatar(displayName, avatar)
    },
    [withSession],
  )

  const closeRoom = useCallback(async () => {
    const session = sessionRef.current
    if (!session) return false

    const result = await postJson(`/api/rooms/${encodeURIComponent(session.roomId)}/close-room`, {
      participantId: session.participantId,
    })

    if (!result.ok) {
      setError(result.error)
      return false
    }

    handleRoomClosed('You closed the room.')
    return true
  }, [handleRoomClosed])

  const leaveRoom = useCallback(async () => {
    const session = sessionRef.current
    if (session) {
      await postJson(`/api/rooms/${encodeURIComponent(session.roomId)}/leave`, {
        participantId: session.participantId,
      })
    }

    closeStream()
    sessionRef.current = null
    clearRoomSession()
    setRoom(null)
    setError(null)
    clearInvitePath()
    setInviteRoomId(null)
    setRestoringSession(false)
  }, [closeStream])

  return {
    connected,
    error,
    room,
    inviteRoomId,
    restoringSession,
    createRoom,
    joinRoom,
    addCard,
    updateCard,
    deleteCard,
    moveCard,
    voteCard,
    unvoteCard,
    groupCards,
    ungroupCard,
    addColumn,
    removeColumn,
    renameColumn,
    updateTitle,
    toggleReaction,
    addComment,
    toggleCommentLike,
    toggleCommentReaction,
    deleteComment,
    setPhase,
    startTimer,
    stopTimer,
    assignFacilitator,
    updateAvatar,
    closeRoom,
    leaveRoom,
    clearError: () => setError(null),
  }
}
