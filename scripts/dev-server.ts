import express from 'express'
import { emitRoomClosed, emitRoomState, subscribe } from '../lib/broadcast.js'
import { isValidPhase } from '../lib/exportSummary.js'
import {
  addCard,
  addCardComment,
  addColumn,
  assignFacilitator,
  createRoom,
  deleteCard,
  deleteCardComment,
  destroyRoom,
  getRoom,
  getRoomPublicInfo,
  groupCards,
  joinRoom,
  leaveRoom,
  moveCard,
  removeColumn,
  renameColumn,
  serializeRoom,
  setPhase,
  startTimer,
  stopTimer,
  toggleCommentLike,
  toggleCommentReaction,
  toggleReaction,
  ungroupCard,
  unvoteCard,
  updateCard,
  updateParticipantAvatar,
  updateRoomTitle,
  voteCard,
} from '../lib/rooms.js'
import type { SessionPayload } from '../lib/types.js'

const PORT = Number(process.env.PORT) || 3000
const MIN_PASSWORD_LENGTH = 4

const app = express()
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.post('/api/rooms/create', async (req, res) => {
  const { name, roomId, title, passwordProtected, password, avatar } = req.body as {
    name?: string
    roomId?: string
    title?: string
    passwordProtected?: boolean
    password?: string
    avatar?: { emoji?: string; color?: string }
  }
  if (!name?.trim()) {
    res.status(400).json({ ok: false, error: 'Name is required' })
    return
  }

  const isProtected = Boolean(passwordProtected)
  const trimmedPassword = password?.trim() ?? ''

  if (isProtected && trimmedPassword.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({
      ok: false,
      error: `Room password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    })
    return
  }

  const { room, participantId } = await createRoom(
    name,
    roomId,
    isProtected ? trimmedPassword : undefined,
    avatar,
    title,
  )
  const state = serializeRoom(room, participantId)
  emitRoomState(room.id)

  const payload: SessionPayload = { roomId: room.id, participantId, state }
  res.json({ ok: true, data: payload })
})

app.post('/api/rooms/join', async (req, res) => {
  const { roomId, name, password, avatar } = req.body as {
    roomId?: string
    name?: string
    password?: string
    avatar?: { emoji?: string; color?: string }
  }
  if (!roomId?.trim() || !name?.trim()) {
    res.status(400).json({ ok: false, error: 'Room ID and name are required' })
    return
  }

  const room = await getRoom(roomId)
  if (!room) {
    res.status(404).json({ ok: false, error: 'Room not found' })
    return
  }

  const needsPassword = room.passwordHash !== null
  const trimmedPassword = password?.trim() ?? ''

  if (needsPassword && !trimmedPassword) {
    res.status(400).json({ ok: false, error: 'Room password is required' })
    return
  }

  const result = await joinRoom(roomId, name, trimmedPassword || undefined, avatar)
  if (!result.ok) {
    const errors = {
      not_found: { status: 404, message: 'Room not found' },
      wrong_password: { status: 401, message: 'Incorrect room password' },
      duplicate_name: { status: 409, message: 'That name is already taken in this room' },
      room_full: { status: 403, message: 'This room is full' },
    } as const
    const { status, message } = errors[result.reason]
    res.status(status).json({ ok: false, error: message })
    return
  }

  const { room: joinedRoom, participantId } = result
  const state = serializeRoom(joinedRoom, participantId)
  emitRoomState(joinedRoom.id)

  const payload: SessionPayload = { roomId: joinedRoom.id, participantId, state }
  res.json({ ok: true, data: payload })
})

app.get('/api/rooms/:roomId/info', async (req, res) => {
  const info = await getRoomPublicInfo(req.params.roomId)
  if (!info) {
    res.status(404).json({ ok: false, error: 'Room not found' })
    return
  }
  res.json({ ok: true, data: info })
})

app.get('/api/rooms/:roomId/stream', async (req, res) => {
  const { roomId } = req.params
  const participantId = req.query.participantId

  if (typeof participantId !== 'string') {
    res.status(400).json({ ok: false, error: 'participantId is required' })
    return
  }

  const room = await getRoom(roomId)
  if (!room || !room.participants.has(participantId)) {
    res.status(404).json({ ok: false, error: 'Room or participant not found' })
    return
  }

  subscribe(roomId, participantId, res)
})

function actionRoute(
  action: string,
  handler: (roomId: string, body: Record<string, unknown>) => Promise<boolean>,
  errorMessage: string,
  forbiddenStatus = 400,
) {
  app.post(`/api/rooms/:roomId/${action}`, async (req, res) => {
    const ok = await handler(req.params.roomId, req.body as Record<string, unknown>)
    if (!ok) {
      res.status(forbiddenStatus).json({ ok: false, error: errorMessage })
      return
    }
    emitRoomState(req.params.roomId)
    res.json({ ok: true })
  })
}

actionRoute(
  'add-card',
  async (roomId, body) => {
    const { participantId, columnId, text, emoji } = body
    return (
      typeof participantId === 'string' &&
      typeof columnId === 'string' &&
      typeof text === 'string' &&
      (await addCard(
        roomId,
        participantId,
        columnId,
        text,
        typeof emoji === 'string' ? emoji : undefined,
      ))
    )
  },
  'Unable to add card',
)

actionRoute(
  'update-card',
  async (roomId, body) => {
    const { participantId, cardId, text, emoji } = body
    return (
      typeof participantId === 'string' &&
      typeof cardId === 'string' &&
      typeof text === 'string' &&
      (await updateCard(
        roomId,
        participantId,
        cardId,
        text,
        emoji === null ? null : typeof emoji === 'string' ? emoji : undefined,
      ))
    )
  },
  'Unable to update card',
)

actionRoute(
  'delete-card',
  async (roomId, body) => {
    const { participantId, cardId } = body
    return (
      typeof participantId === 'string' &&
      typeof cardId === 'string' &&
      (await deleteCard(roomId, participantId, cardId))
    )
  },
  'Unable to delete card',
)

actionRoute(
  'move-card',
  async (roomId, body) => {
    const { participantId, cardId, columnId } = body
    return (
      typeof participantId === 'string' &&
      typeof cardId === 'string' &&
      typeof columnId === 'string' &&
      (await moveCard(roomId, participantId, cardId, columnId))
    )
  },
  'Unable to move card',
)

actionRoute(
  'add-column',
  async (roomId, body) => {
    const { participantId, label } = body
    return (
      typeof participantId === 'string' &&
      typeof label === 'string' &&
      (await addColumn(roomId, participantId, label))
    )
  },
  'Unable to add column',
  403,
)

actionRoute(
  'remove-column',
  async (roomId, body) => {
    const { participantId, columnId } = body
    return (
      typeof participantId === 'string' &&
      typeof columnId === 'string' &&
      (await removeColumn(roomId, participantId, columnId))
    )
  },
  'Unable to remove column',
  403,
)

actionRoute(
  'rename-column',
  async (roomId, body) => {
    const { participantId, columnId, label } = body
    return (
      typeof participantId === 'string' &&
      typeof columnId === 'string' &&
      typeof label === 'string' &&
      (await renameColumn(roomId, participantId, columnId, label))
    )
  },
  'Unable to rename column',
  403,
)

actionRoute(
  'update-title',
  async (roomId, body) => {
    const { participantId, title } = body
    return (
      typeof participantId === 'string' &&
      typeof title === 'string' &&
      (await updateRoomTitle(roomId, participantId, title))
    )
  },
  'Unable to update title',
  403,
)

actionRoute(
  'toggle-reaction',
  async (roomId, body) => {
    const { participantId, cardId, emoji } = body
    return (
      typeof participantId === 'string' &&
      typeof cardId === 'string' &&
      typeof emoji === 'string' &&
      (await toggleReaction(roomId, participantId, cardId, emoji))
    )
  },
  'Unable to toggle reaction',
)

actionRoute(
  'add-comment',
  async (roomId, body) => {
    const { participantId, cardId, text, parentId } = body
    return (
      typeof participantId === 'string' &&
      typeof cardId === 'string' &&
      typeof text === 'string' &&
      (await addCardComment(
        roomId,
        participantId,
        cardId,
        text,
        typeof parentId === 'string' ? parentId : null,
      ))
    )
  },
  'Unable to add comment',
)

actionRoute(
  'toggle-comment-like',
  async (roomId, body) => {
    const { participantId, cardId, commentId } = body
    return (
      typeof participantId === 'string' &&
      typeof cardId === 'string' &&
      typeof commentId === 'string' &&
      (await toggleCommentLike(roomId, participantId, cardId, commentId))
    )
  },
  'Unable to toggle like',
)

actionRoute(
  'toggle-comment-reaction',
  async (roomId, body) => {
    const { participantId, cardId, commentId, emoji } = body
    return (
      typeof participantId === 'string' &&
      typeof cardId === 'string' &&
      typeof commentId === 'string' &&
      typeof emoji === 'string' &&
      (await toggleCommentReaction(roomId, participantId, cardId, commentId, emoji))
    )
  },
  'Unable to toggle comment reaction',
)

actionRoute(
  'delete-comment',
  async (roomId, body) => {
    const { participantId, cardId, commentId } = body
    return (
      typeof participantId === 'string' &&
      typeof cardId === 'string' &&
      typeof commentId === 'string' &&
      (await deleteCardComment(roomId, participantId, cardId, commentId))
    )
  },
  'Unable to delete comment',
  403,
)

actionRoute(
  'vote-card',
  async (roomId, body) => {
    const { participantId, cardId } = body
    return (
      typeof participantId === 'string' &&
      typeof cardId === 'string' &&
      (await voteCard(roomId, participantId, cardId))
    )
  },
  'Unable to vote on card',
)

actionRoute(
  'unvote-card',
  async (roomId, body) => {
    const { participantId, cardId } = body
    return (
      typeof participantId === 'string' &&
      typeof cardId === 'string' &&
      (await unvoteCard(roomId, participantId, cardId))
    )
  },
  'Unable to remove vote',
)

actionRoute(
  'group-cards',
  async (roomId, body) => {
    const { participantId, cardIds } = body
    return (
      typeof participantId === 'string' &&
      Array.isArray(cardIds) &&
      cardIds.length >= 2 &&
      (await groupCards(roomId, participantId, cardIds as string[]))
    )
  },
  'Unable to group cards',
  403,
)

actionRoute(
  'ungroup-card',
  async (roomId, body) => {
    const { participantId, cardId } = body
    return (
      typeof participantId === 'string' &&
      typeof cardId === 'string' &&
      (await ungroupCard(roomId, participantId, cardId))
    )
  },
  'Unable to ungroup card',
  403,
)

actionRoute(
  'set-phase',
  async (roomId, body) => {
    const { participantId, phase } = body
    return (
      typeof participantId === 'string' &&
      isValidPhase(phase) &&
      (await setPhase(roomId, participantId, phase))
    )
  },
  'Only the facilitator can change phase',
  403,
)

actionRoute(
  'start-timer',
  async (roomId, body) => {
    const { participantId, durationSec } = body
    return (
      typeof participantId === 'string' &&
      typeof durationSec === 'number' &&
      (await startTimer(roomId, participantId, durationSec))
    )
  },
  'Unable to start timer',
  403,
)

actionRoute(
  'stop-timer',
  async (roomId, body) => {
    const { participantId } = body
    return typeof participantId === 'string' && (await stopTimer(roomId, participantId))
  },
  'Unable to stop timer',
  403,
)

actionRoute(
  'assign-facilitator',
  async (roomId, body) => {
    const { participantId, facilitatorId } = body
    return (
      typeof participantId === 'string' &&
      typeof facilitatorId === 'string' &&
      (await assignFacilitator(roomId, participantId, facilitatorId))
    )
  },
  'Only the room creator can assign facilitator',
  403,
)

app.post('/api/rooms/:roomId/close-room', async (req, res) => {
  const { participantId } = req.body as { participantId?: string }
  if (!participantId) {
    res.status(400).json({ ok: false, error: 'participantId is required' })
    return
  }
  if (!(await destroyRoom(req.params.roomId, participantId))) {
    res.status(403).json({ ok: false, error: 'Only the facilitator can close the room' })
    return
  }
  emitRoomClosed(req.params.roomId)
  res.json({ ok: true })
})

app.post('/api/rooms/:roomId/leave', async (req, res) => {
  const { participantId } = req.body as { participantId?: string }
  if (!participantId) {
    res.status(400).json({ ok: false, error: 'participantId is required' })
    return
  }
  await leaveRoom(participantId, req.params.roomId)
  emitRoomState(req.params.roomId)
  res.json({ ok: true })
})

app.post('/api/rooms/:roomId/avatar', async (req, res) => {
  const { participantId, avatar } = req.body as {
    participantId?: string
    avatar?: { emoji?: string; color?: string }
  }
  if (!participantId || !avatar) {
    res.status(400).json({ ok: false, error: 'participantId and avatar are required' })
    return
  }
  if (!(await updateParticipantAvatar(req.params.roomId, participantId, avatar))) {
    res.status(400).json({ ok: false, error: 'Unable to update avatar' })
    return
  }
  emitRoomState(req.params.roomId)
  res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`Local API server listening on http://localhost:${PORT}`)
}).on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other process or run with PORT=3001`)
  } else {
    console.error(error)
  }
  process.exit(1)
})
