import type { VercelRequest, VercelResponse } from '@vercel/node'
import { emitRoomClosed, emitRoomState, notifyAfterLeave, subscribe } from './broadcast.js'
import { isValidPhase } from './exportSummary.js'
import { methodNotAllowed, readJsonBody } from './http.js'
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
  resumeRoom,
  serializeRoom,
  setPhase,
  startTimer,
  stopTimer,
  setCommentAuthorsVisible,
  toggleCommentLike,
  toggleCommentReaction,
  toggleReaction,
  ungroupCard,
  unvoteCard,
  updateCard,
  updateParticipantAvatar,
  updateRoomTitle,
  voteCard,
} from './rooms.js'
import type { SessionPayload } from './types.js'

const MIN_PASSWORD_LENGTH = 4

export async function handleCreateRoom(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST'])
    return
  }

  const body = await readJsonBody<{
    name?: string
    roomId?: string
    title?: string
    passwordProtected?: boolean
    password?: string
    avatar?: { emoji?: string; color?: string }
  }>(req)

  if (!body?.name?.trim()) {
    res.status(400).json({ ok: false, error: 'Name is required' })
    return
  }

  const passwordProtected = Boolean(body.passwordProtected)
  const password = body.password?.trim() ?? ''

  if (passwordProtected && password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({
      ok: false,
      error: `Room password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    })
    return
  }

  const { room, participantId } = await createRoom(
    body.name,
    body.roomId,
    passwordProtected ? password : undefined,
    body.avatar,
    body.title,
  )
  const state = serializeRoom(room, participantId)
  emitRoomState(room.id)

  const payload: SessionPayload = { roomId: room.id, participantId, state }
  res.status(200).json({ ok: true, data: payload })
}

export async function handleJoinRoom(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST'])
    return
  }

  const body = await readJsonBody<{
    roomId?: string
    name?: string
    password?: string
    participantId?: string
    avatar?: { emoji?: string; color?: string }
  }>(req)

  if (!body?.roomId?.trim() || !body?.name?.trim()) {
    res.status(400).json({ ok: false, error: 'Room ID and name are required' })
    return
  }

  const room = await getRoom(body.roomId)
  if (!room) {
    res.status(404).json({ ok: false, error: 'Room not found' })
    return
  }

  const passwordProtected = room.passwordHash !== null
  const password = body.password?.trim() ?? ''

  if (passwordProtected && !password) {
    res.status(400).json({ ok: false, error: 'Room password is required' })
    return
  }

  const result = await joinRoom(
    body.roomId,
    body.name,
    password || undefined,
    body.avatar,
    body.participantId,
  )
  if (!result.ok) {
    const errors: Record<typeof result.reason, { status: number; message: string }> = {
      not_found: { status: 404, message: 'Room not found' },
      wrong_password: { status: 401, message: 'Incorrect room password' },
      duplicate_name: { status: 409, message: 'That name is already taken in this room' },
      room_full: { status: 403, message: 'This room is full' },
    }
    const { status, message } = errors[result.reason]
    res.status(status).json({ ok: false, error: message })
    return
  }

  const { room: joinedRoom, participantId } = result
  const state = serializeRoom(joinedRoom, participantId)
  emitRoomState(joinedRoom.id)

  const payload: SessionPayload = { roomId: joinedRoom.id, participantId, state }
  res.status(200).json({ ok: true, data: payload })
}

export async function handleResumeRoom(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST'])
    return
  }

  const body = await readJsonBody<{
    roomId?: string
    participantId?: string
  }>(req)

  if (!body?.roomId?.trim() || !body?.participantId?.trim()) {
    res.status(400).json({ ok: false, error: 'Room ID and participant ID are required' })
    return
  }

  const result = await resumeRoom(body.roomId, body.participantId)
  if (!result.ok) {
    const errors = {
      not_found: { status: 404, message: 'Room not found' },
      participant_not_found: { status: 404, message: 'Session expired — rejoin with your name' },
    } as const
    const { status, message } = errors[result.reason]
    res.status(status).json({ ok: false, error: message })
    return
  }

  const { room, participantId } = result
  const state = serializeRoom(room, participantId)
  emitRoomState(room.id)

  const payload: SessionPayload = { roomId: room.id, participantId, state }
  res.status(200).json({ ok: true, data: payload })
}

export async function handleRoomInfo(
  req: VercelRequest,
  res: VercelResponse,
  roomId: string,
): Promise<void> {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET'])
    return
  }

  const info = await getRoomPublicInfo(roomId)
  if (!info) {
    res.status(404).json({ ok: false, error: 'Room not found' })
    return
  }

  res.status(200).json({ ok: true, data: info })
}

export async function handleRoomStream(
  req: VercelRequest,
  res: VercelResponse,
  roomId: string,
): Promise<void> {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET'])
    return
  }

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
}

export async function handleRoomAction(
  req: VercelRequest,
  res: VercelResponse,
  roomId: string,
  action: string,
): Promise<void> {
  switch (action) {
    case 'add-card':
      return handleAddCard(req, res, roomId)
    case 'update-card':
      return handleUpdateCard(req, res, roomId)
    case 'delete-card':
      return handleDeleteCard(req, res, roomId)
    case 'move-card':
      return handleMoveCard(req, res, roomId)
    case 'add-column':
      return handleAddColumn(req, res, roomId)
    case 'remove-column':
      return handleRemoveColumn(req, res, roomId)
    case 'rename-column':
      return handleRenameColumn(req, res, roomId)
    case 'update-title':
      return handleUpdateTitle(req, res, roomId)
    case 'set-comment-authors-visible':
      return handleSetCommentAuthorsVisible(req, res, roomId)
    case 'toggle-reaction':
      return handleToggleReaction(req, res, roomId)
    case 'add-comment':
      return handleAddComment(req, res, roomId)
    case 'toggle-comment-like':
      return handleToggleCommentLike(req, res, roomId)
    case 'toggle-comment-reaction':
      return handleToggleCommentReaction(req, res, roomId)
    case 'delete-comment':
      return handleDeleteComment(req, res, roomId)
    case 'vote-card':
      return handleVoteCard(req, res, roomId)
    case 'unvote-card':
      return handleUnvoteCard(req, res, roomId)
    case 'group-cards':
      return handleGroupCards(req, res, roomId)
    case 'ungroup-card':
      return handleUngroupCard(req, res, roomId)
    case 'set-phase':
      return handleSetPhase(req, res, roomId)
    case 'start-timer':
      return handleStartTimer(req, res, roomId)
    case 'stop-timer':
      return handleStopTimer(req, res, roomId)
    case 'assign-facilitator':
      return handleAssignFacilitator(req, res, roomId)
    case 'close-room':
      return handleCloseRoom(req, res, roomId)
    case 'leave':
      return handleLeave(req, res, roomId)
    case 'avatar':
      return handleAvatar(req, res, roomId)
    default:
      res.status(404).json({ ok: false, error: 'Not found' })
  }
}

async function requireParticipantId(
  req: VercelRequest,
  res: VercelResponse,
): Promise<string | null> {
  const body = await readJsonBody<{ participantId?: string }>(req)
  if (!body?.participantId) {
    res.status(400).json({ ok: false, error: 'participantId is required' })
    return null
  }
  return body.participantId
}

async function handleAddCard(req: VercelRequest, res: VercelResponse, roomId: string) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const body = await readJsonBody<{
    participantId?: string
    columnId?: string
    text?: string
    emoji?: string
  }>(req)
  if (!body?.participantId || typeof body.columnId !== 'string' || !body.text?.trim()) {
    res.status(400).json({ ok: false, error: 'participantId, columnId, and text are required' })
    return
  }
  if (!(await addCard(roomId, body.participantId, body.columnId, body.text, body.emoji))) {
    res.status(400).json({ ok: false, error: 'Unable to add card' })
    return
  }
  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleUpdateCard(req: VercelRequest, res: VercelResponse, roomId: string) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const body = await readJsonBody<{
    participantId?: string
    cardId?: string
    text?: string
    emoji?: string | null
  }>(req)
  if (!body?.participantId || !body.cardId || !body.text?.trim()) {
    res.status(400).json({ ok: false, error: 'participantId, cardId, and text are required' })
    return
  }
  if (!(await updateCard(roomId, body.participantId, body.cardId, body.text, body.emoji))) {
    res.status(400).json({ ok: false, error: 'Unable to update card' })
    return
  }
  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleDeleteCard(req: VercelRequest, res: VercelResponse, roomId: string) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const body = await readJsonBody<{ participantId?: string; cardId?: string }>(req)
  if (!body?.participantId || !body.cardId) {
    res.status(400).json({ ok: false, error: 'participantId and cardId are required' })
    return
  }
  if (!(await deleteCard(roomId, body.participantId, body.cardId))) {
    res.status(400).json({ ok: false, error: 'Unable to delete card' })
    return
  }
  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleMoveCard(req: VercelRequest, res: VercelResponse, roomId: string) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const body = await readJsonBody<{ participantId?: string; cardId?: string; columnId?: string }>(
    req,
  )
  if (!body?.participantId || !body.cardId || typeof body.columnId !== 'string') {
    res.status(400).json({ ok: false, error: 'participantId, cardId, and columnId are required' })
    return
  }
  if (!(await moveCard(roomId, body.participantId, body.cardId, body.columnId))) {
    res.status(400).json({ ok: false, error: 'Unable to move card' })
    return
  }
  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleAddColumn(req: VercelRequest, res: VercelResponse, roomId: string) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const body = await readJsonBody<{ participantId?: string; label?: string }>(req)
  if (!body?.participantId || !body.label?.trim()) {
    res.status(400).json({ ok: false, error: 'participantId and label are required' })
    return
  }
  if (!(await addColumn(roomId, body.participantId, body.label))) {
    res.status(403).json({ ok: false, error: 'Unable to add column' })
    return
  }
  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleRemoveColumn(req: VercelRequest, res: VercelResponse, roomId: string) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const body = await readJsonBody<{ participantId?: string; columnId?: string }>(req)
  if (!body?.participantId || !body.columnId) {
    res.status(400).json({ ok: false, error: 'participantId and columnId are required' })
    return
  }
  if (!(await removeColumn(roomId, body.participantId, body.columnId))) {
    res.status(403).json({ ok: false, error: 'Unable to remove column' })
    return
  }
  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleRenameColumn(req: VercelRequest, res: VercelResponse, roomId: string) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const body = await readJsonBody<{ participantId?: string; columnId?: string; label?: string }>(
    req,
  )
  if (!body?.participantId || !body.columnId || !body.label?.trim()) {
    res.status(400).json({ ok: false, error: 'participantId, columnId, and label are required' })
    return
  }
  if (!(await renameColumn(roomId, body.participantId, body.columnId, body.label))) {
    res.status(403).json({ ok: false, error: 'Unable to rename column' })
    return
  }
  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleUpdateTitle(req: VercelRequest, res: VercelResponse, roomId: string) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const body = await readJsonBody<{ participantId?: string; title?: string }>(req)
  if (!body?.participantId || typeof body.title !== 'string') {
    res.status(400).json({ ok: false, error: 'participantId and title are required' })
    return
  }
  if (!(await updateRoomTitle(roomId, body.participantId, body.title))) {
    res.status(403).json({ ok: false, error: 'Unable to update title' })
    return
  }
  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleSetCommentAuthorsVisible(
  req: VercelRequest,
  res: VercelResponse,
  roomId: string,
) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const body = await readJsonBody<{ participantId?: string; visible?: boolean }>(req)
  if (!body?.participantId || typeof body.visible !== 'boolean') {
    res.status(400).json({ ok: false, error: 'participantId and visible are required' })
    return
  }
  if (!(await setCommentAuthorsVisible(roomId, body.participantId, body.visible))) {
    res.status(403).json({ ok: false, error: 'Only the facilitator can change comment name visibility' })
    return
  }
  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleToggleReaction(req: VercelRequest, res: VercelResponse, roomId: string) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const body = await readJsonBody<{ participantId?: string; cardId?: string; emoji?: string }>(req)
  if (!body?.participantId || !body.cardId || !body.emoji?.trim()) {
    res.status(400).json({ ok: false, error: 'participantId, cardId, and emoji are required' })
    return
  }
  if (!(await toggleReaction(roomId, body.participantId, body.cardId, body.emoji))) {
    res.status(400).json({ ok: false, error: 'Unable to toggle reaction' })
    return
  }
  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleAddComment(req: VercelRequest, res: VercelResponse, roomId: string) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const body = await readJsonBody<{
    participantId?: string
    cardId?: string
    text?: string
    parentId?: string | null
  }>(req)
  if (!body?.participantId || !body.cardId || !body.text?.trim()) {
    res.status(400).json({ ok: false, error: 'participantId, cardId, and text are required' })
    return
  }
  if (!(await addCardComment(roomId, body.participantId, body.cardId, body.text, body.parentId))) {
    res.status(400).json({ ok: false, error: 'Unable to add comment' })
    return
  }
  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleToggleCommentLike(req: VercelRequest, res: VercelResponse, roomId: string) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const body = await readJsonBody<{ participantId?: string; cardId?: string; commentId?: string }>(
    req,
  )
  if (!body?.participantId || !body.cardId || !body.commentId) {
    res.status(400).json({ ok: false, error: 'participantId, cardId, and commentId are required' })
    return
  }
  if (!(await toggleCommentLike(roomId, body.participantId, body.cardId, body.commentId))) {
    res.status(400).json({ ok: false, error: 'Unable to toggle like' })
    return
  }
  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleToggleCommentReaction(
  req: VercelRequest,
  res: VercelResponse,
  roomId: string,
) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const body = await readJsonBody<{
    participantId?: string
    cardId?: string
    commentId?: string
    emoji?: string
  }>(req)
  if (!body?.participantId || !body.cardId || !body.commentId || !body.emoji?.trim()) {
    res.status(400).json({
      ok: false,
      error: 'participantId, cardId, commentId, and emoji are required',
    })
    return
  }
  if (
    !(await toggleCommentReaction(
      roomId,
      body.participantId,
      body.cardId,
      body.commentId,
      body.emoji,
    ))
  ) {
    res.status(400).json({ ok: false, error: 'Unable to toggle comment reaction' })
    return
  }
  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleDeleteComment(req: VercelRequest, res: VercelResponse, roomId: string) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const body = await readJsonBody<{ participantId?: string; cardId?: string; commentId?: string }>(
    req,
  )
  if (!body?.participantId || !body.cardId || !body.commentId) {
    res.status(400).json({ ok: false, error: 'participantId, cardId, and commentId are required' })
    return
  }
  if (!(await deleteCardComment(roomId, body.participantId, body.cardId, body.commentId))) {
    res.status(403).json({ ok: false, error: 'Unable to delete comment' })
    return
  }
  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleVoteCard(req: VercelRequest, res: VercelResponse, roomId: string) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const body = await readJsonBody<{ participantId?: string; cardId?: string }>(req)
  if (!body?.participantId || !body.cardId) {
    res.status(400).json({ ok: false, error: 'participantId and cardId are required' })
    return
  }
  if (!(await voteCard(roomId, body.participantId, body.cardId))) {
    res.status(400).json({ ok: false, error: 'Unable to vote on card' })
    return
  }
  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleUnvoteCard(req: VercelRequest, res: VercelResponse, roomId: string) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const body = await readJsonBody<{ participantId?: string; cardId?: string }>(req)
  if (!body?.participantId || !body.cardId) {
    res.status(400).json({ ok: false, error: 'participantId and cardId are required' })
    return
  }
  if (!(await unvoteCard(roomId, body.participantId, body.cardId))) {
    res.status(400).json({ ok: false, error: 'Unable to remove vote' })
    return
  }
  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleGroupCards(req: VercelRequest, res: VercelResponse, roomId: string) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const body = await readJsonBody<{ participantId?: string; cardIds?: string[] }>(req)
  if (!body?.participantId || !Array.isArray(body.cardIds) || body.cardIds.length < 2) {
    res.status(400).json({ ok: false, error: 'participantId and at least 2 cardIds are required' })
    return
  }
  if (!(await groupCards(roomId, body.participantId, body.cardIds))) {
    res.status(403).json({ ok: false, error: 'Unable to group cards' })
    return
  }
  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleUngroupCard(req: VercelRequest, res: VercelResponse, roomId: string) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const body = await readJsonBody<{ participantId?: string; cardId?: string }>(req)
  if (!body?.participantId || !body.cardId) {
    res.status(400).json({ ok: false, error: 'participantId and cardId are required' })
    return
  }
  if (!(await ungroupCard(roomId, body.participantId, body.cardId))) {
    res.status(403).json({ ok: false, error: 'Unable to ungroup card' })
    return
  }
  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleSetPhase(req: VercelRequest, res: VercelResponse, roomId: string) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const body = await readJsonBody<{ participantId?: string; phase?: string }>(req)
  if (!body?.participantId || !isValidPhase(body.phase)) {
    res.status(400).json({ ok: false, error: 'participantId and valid phase are required' })
    return
  }
  if (!(await setPhase(roomId, body.participantId, body.phase))) {
    res.status(403).json({ ok: false, error: 'Only the facilitator can change phase' })
    return
  }
  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleStartTimer(req: VercelRequest, res: VercelResponse, roomId: string) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const body = await readJsonBody<{ participantId?: string; durationSec?: number }>(req)
  if (!body?.participantId || typeof body.durationSec !== 'number') {
    res.status(400).json({ ok: false, error: 'participantId and durationSec are required' })
    return
  }
  if (!(await startTimer(roomId, body.participantId, body.durationSec))) {
    res.status(403).json({ ok: false, error: 'Unable to start timer' })
    return
  }
  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleStopTimer(req: VercelRequest, res: VercelResponse, roomId: string) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const participantId = await requireParticipantId(req, res)
  if (!participantId) return
  if (!(await stopTimer(roomId, participantId))) {
    res.status(403).json({ ok: false, error: 'Unable to stop timer' })
    return
  }
  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleAssignFacilitator(req: VercelRequest, res: VercelResponse, roomId: string) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const body = await readJsonBody<{ participantId?: string; facilitatorId?: string }>(req)
  if (!body?.participantId || !body.facilitatorId) {
    res.status(400).json({ ok: false, error: 'participantId and facilitatorId are required' })
    return
  }
  if (!(await assignFacilitator(roomId, body.participantId, body.facilitatorId))) {
    res.status(403).json({ ok: false, error: 'Only the room creator can assign facilitator' })
    return
  }
  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleCloseRoom(req: VercelRequest, res: VercelResponse, roomId: string) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const participantId = await requireParticipantId(req, res)
  if (!participantId) return
  if (!(await destroyRoom(roomId, participantId))) {
    res.status(403).json({ ok: false, error: 'Only the facilitator can close the room' })
    return
  }
  emitRoomClosed(roomId)
  res.status(200).json({ ok: true })
}

async function handleLeave(req: VercelRequest, res: VercelResponse, roomId: string) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const participantId = await requireParticipantId(req, res)
  if (!participantId) return
  await leaveRoom(participantId, roomId)
  await notifyAfterLeave(roomId, participantId)
  res.status(200).json({ ok: true })
}

async function handleAvatar(req: VercelRequest, res: VercelResponse, roomId: string) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const body = await readJsonBody<{
    participantId?: string
    avatar?: { emoji?: string; color?: string }
  }>(req)
  if (!body?.participantId || !body.avatar) {
    res.status(400).json({ ok: false, error: 'participantId and avatar are required' })
    return
  }
  if (!(await updateParticipantAvatar(roomId, body.participantId, body.avatar))) {
    res.status(400).json({ ok: false, error: 'Unable to update avatar' })
    return
  }
  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}
