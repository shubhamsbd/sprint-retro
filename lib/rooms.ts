import { randomBytes, randomUUID } from 'node:crypto'
import { parseAvatar } from './avatars.js'
import { createPasswordRecord, verifyPassword } from './password.js'
import {
  deletePersistedRoom,
  loadPersistedRoom,
  persistedRoomExists,
  savePersistedRoom,
  type PersistedRoom,
} from './roomPersistence.js'
import type {
  CardComment,
  CardReactions,
  ClientRoomState,
  ColumnId,
  MergedCardSnapshot,
  Participant,
  RetroColumnDef,
  RetroPhase,
  StickyCard,
} from './types.js'
import { DEFAULT_COLUMNS } from './types.js'

export const MAX_PARTICIPANTS = 20
export const MAX_COLUMNS = 6
export const MIN_COLUMNS = 1
export const MAX_COMMENT_LENGTH = 500
export const MAX_COMMENTS_PER_CARD = 80
export const MAX_ROOM_TITLE_LENGTH = 80

export interface Room {
  id: string
  title: string
  phase: RetroPhase
  creatorId: string
  facilitatorId: string | null
  timerEndsAt: number | null
  timerDurationSec: number | null
  showCommentAuthors: boolean
  passwordSalt: string | null
  passwordHash: string | null
  columns: RetroColumnDef[]
  participants: Map<string, Participant>
  cards: Map<string, StickyCard>
  revision: number
}

export type JoinFailureReason =
  | 'not_found'
  | 'wrong_password'
  | 'duplicate_name'
  | 'room_full'

function generateRoomId(): string {
  return randomBytes(3).toString('hex').toUpperCase()
}

function isPasswordProtected(room: Room): boolean {
  return room.passwordHash !== null && room.passwordSalt !== null
}

function resolveColumns(persisted: PersistedRoom): RetroColumnDef[] {
  return persisted.columns?.length ? persisted.columns : [...DEFAULT_COLUMNS]
}

function columnExists(room: Room, columnId: string): boolean {
  return room.columns.some((c) => c.id === columnId)
}

function parseEmoji(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 8) return undefined
  return trimmed
}

function normalizeComment(comment: CardComment): CardComment {
  return {
    ...comment,
    likes: comment.likes ?? [],
    reactions: comment.reactions ?? {},
  }
}

function normalizeCard(card: StickyCard): StickyCard {
  return {
    ...card,
    reactions: card.reactions ?? {},
    comments: (card.comments ?? []).map(normalizeComment),
  }
}

function canInteractOnCard(room: Room): boolean {
  return room.phase !== 'done'
}

function findComment(card: StickyCard, commentId: string): CardComment | undefined {
  return card.comments?.find((c) => c.id === commentId)
}

function toggleReactionMap(
  reactions: CardReactions,
  participantId: string,
  emoji: string,
): CardReactions {
  const next = { ...reactions }
  const current = next[emoji] ?? []
  const existingIndex = current.indexOf(participantId)
  if (existingIndex >= 0) {
    const filtered = current.filter((id) => id !== participantId)
    if (filtered.length === 0) {
      delete next[emoji]
    } else {
      next[emoji] = filtered
    }
  } else {
    next[emoji] = [...current, participantId]
  }
  return next
}

function mergeComments(cards: StickyCard[]): CardComment[] {
  const all: CardComment[] = []
  for (const card of cards) {
    all.push(...(card.comments ?? []))
  }
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

function mergeReactions(cards: StickyCard[]): CardReactions {
  const merged: CardReactions = {}
  for (const card of cards) {
    for (const [emoji, participantIds] of Object.entries(card.reactions ?? {})) {
      if (!merged[emoji]) merged[emoji] = []
      for (const participantId of participantIds) {
        if (!merged[emoji].includes(participantId)) {
          merged[emoji].push(participantId)
        }
      }
    }
  }
  return merged
}

function toRoom(persisted: PersistedRoom): Room {
  return {
    ...persisted,
    title: persisted.title?.trim() ?? '',
    showCommentAuthors: persisted.showCommentAuthors ?? true,
    columns: resolveColumns(persisted),
    participants: new Map(persisted.participants.map((p) => [p.id, p])),
    cards: new Map(persisted.cards.map((c) => [c.id, normalizeCard(c)])),
  }
}

function toPersisted(room: Room): PersistedRoom {
  return {
    id: room.id,
    title: room.title,
    phase: room.phase,
    creatorId: room.creatorId,
    facilitatorId: room.facilitatorId,
    timerEndsAt: room.timerEndsAt,
    timerDurationSec: room.timerDurationSec,
    showCommentAuthors: room.showCommentAuthors,
    passwordSalt: room.passwordSalt,
    passwordHash: room.passwordHash,
    columns: room.columns,
    participants: [...room.participants.values()],
    cards: [...room.cards.values()],
    revision: room.revision,
  }
}

async function persistRoom(room: Room): Promise<Room> {
  await savePersistedRoom(toPersisted(room))
  const reloaded = await loadPersistedRoom(room.id)
  return reloaded ? toRoom(reloaded) : room
}

function isFacilitator(room: Room, participantId: string): boolean {
  return room.facilitatorId === participantId
}

function canEditCard(room: Room, participantId: string, card: StickyCard): boolean {
  if (room.phase === 'done') return false
  if (room.phase !== 'collect' && room.phase !== 'discuss') return false
  return isFacilitator(room, participantId) || card.authorId === participantId
}

export async function createRoom(
  name: string,
  preferredId?: string,
  password?: string,
  avatarInput?: unknown,
  titleInput?: string,
): Promise<{ room: Room; participantId: string }> {
  let id = preferredId?.trim().toUpperCase() || generateRoomId()
  if (await persistedRoomExists(id)) {
    id = generateRoomId()
  }

  const participantId = randomUUID()
  const trimmedPassword = password?.trim() ?? ''
  const credentials =
    trimmedPassword.length > 0 ? createPasswordRecord(trimmedPassword) : null

  const trimmedName = name.trim()
  const host: Participant = {
    id: participantId,
    name: trimmedName,
    avatar: parseAvatar(avatarInput, trimmedName),
  }

  const title = (titleInput?.trim() ?? '').slice(0, MAX_ROOM_TITLE_LENGTH)

  const room: Room = {
    id,
    title,
    phase: 'collect',
    creatorId: participantId,
    facilitatorId: participantId,
    timerEndsAt: null,
    timerDurationSec: null,
    showCommentAuthors: true,
    passwordSalt: credentials?.salt ?? null,
    passwordHash: credentials?.hash ?? null,
    columns: [...DEFAULT_COLUMNS],
    participants: new Map([[participantId, host]]),
    cards: new Map(),
    revision: 0,
  }

  const saved = await persistRoom(room)
  return { room: saved, participantId }
}

export async function getRoom(roomId: string): Promise<Room | undefined> {
  const persisted = await loadPersistedRoom(roomId)
  return persisted ? toRoom(persisted) : undefined
}

export async function getRoomPublicInfo(roomId: string) {
  const room = await getRoom(roomId)
  if (!room) return null

  return {
    roomId: room.id,
    title: room.title,
    passwordProtected: isPasswordProtected(room),
    participantCount: room.participants.size,
    maxParticipants: MAX_PARTICIPANTS,
    isFull: room.participants.size >= MAX_PARTICIPANTS,
  }
}

export async function resumeRoom(
  roomId: string,
  participantId: string,
): Promise<
  | { ok: true; room: Room; participantId: string }
  | { ok: false; reason: 'not_found' | 'participant_not_found' }
> {
  const room = await getRoom(roomId)
  if (!room) return { ok: false, reason: 'not_found' }
  if (!room.participants.has(participantId)) {
    return { ok: false, reason: 'participant_not_found' }
  }
  return { ok: true, room, participantId }
}

export async function joinRoom(
  roomId: string,
  name: string,
  password?: string,
  avatarInput?: unknown,
  reclaimParticipantId?: string,
): Promise<
  | { ok: true; room: Room; participantId: string }
  | { ok: false; reason: JoinFailureReason }
> {
  const room = await getRoom(roomId)
  if (!room) return { ok: false, reason: 'not_found' }

  if (room.participants.size >= MAX_PARTICIPANTS) {
    return { ok: false, reason: 'room_full' }
  }

  if (isPasswordProtected(room)) {
    const trimmedPassword = password?.trim() ?? ''
    if (
      !room.passwordSalt ||
      !room.passwordHash ||
      !verifyPassword(trimmedPassword, room.passwordSalt, room.passwordHash)
    ) {
      return { ok: false, reason: 'wrong_password' }
    }
  }

  const trimmedName = name.trim()
  const trimmedReclaimId = reclaimParticipantId?.trim()

  if (trimmedReclaimId) {
    const existing = room.participants.get(trimmedReclaimId)
    if (existing && existing.name.toLowerCase() === trimmedName.toLowerCase()) {
      return { ok: true, room, participantId: trimmedReclaimId }
    }
  }

  const duplicate = [...room.participants.values()].some(
    (p) => p.name.toLowerCase() === trimmedName.toLowerCase(),
  )
  if (duplicate) return { ok: false, reason: 'duplicate_name' }

  const participantId = randomUUID()
  room.participants.set(participantId, {
    id: participantId,
    name: trimmedName,
    avatar: parseAvatar(avatarInput, trimmedName),
  })

  const saved = await persistRoom(room)
  return { ok: true, room: saved, participantId }
}

export async function updateParticipantAvatar(
  roomId: string,
  participantId: string,
  avatarInput: unknown,
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room) return false

  const participant = room.participants.get(participantId)
  if (!participant) return false

  participant.avatar = parseAvatar(avatarInput, participant.name)
  await persistRoom(room)
  return true
}

export async function assignFacilitator(
  roomId: string,
  requesterId: string,
  facilitatorId: string,
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room || room.creatorId !== requesterId) return false
  if (!room.participants.has(facilitatorId)) return false

  room.facilitatorId = facilitatorId
  await persistRoom(room)
  return true
}

export async function leaveRoom(participantId: string, roomId: string): Promise<void> {
  const room = await getRoom(roomId)
  if (!room) return

  room.participants.delete(participantId)

  if (room.facilitatorId === participantId) {
    const next = room.participants.values().next().value
    room.facilitatorId = next?.id ?? null
  }

  if (room.participants.size === 0) {
    await deletePersistedRoom(room.id)
    return
  }

  await persistRoom(room)
}

export async function destroyRoom(roomId: string, requesterId: string): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room || room.facilitatorId !== requesterId) return false
  await deletePersistedRoom(room.id)
  return true
}

export async function addCard(
  roomId: string,
  participantId: string,
  columnId: ColumnId,
  text: string,
  emoji?: string,
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room || room.phase !== 'collect') return false
  if (!room.participants.has(participantId)) return false
  if (!columnExists(room, columnId)) return false

  const trimmed = text.trim()
  if (!trimmed) return false

  const card: StickyCard = {
    id: randomUUID(),
    columnId,
    text: trimmed,
    emoji: parseEmoji(emoji),
    authorId: participantId,
    groupId: null,
    votes: [],
    reactions: {},
    comments: [],
    createdAt: Date.now(),
  }

  room.cards.set(card.id, card)
  await persistRoom(room)
  return true
}

export async function updateCard(
  roomId: string,
  participantId: string,
  cardId: string,
  text: string,
  emoji?: string | null,
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room) return false

  const card = room.cards.get(cardId)
  if (!card || !canEditCard(room, participantId, card)) return false

  const trimmed = text.trim()
  if (!trimmed) return false

  card.text = trimmed
  if (emoji !== undefined) {
    card.emoji = emoji === null ? undefined : parseEmoji(emoji)
  }
  await persistRoom(room)
  return true
}

export async function deleteCard(
  roomId: string,
  participantId: string,
  cardId: string,
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room) return false

  const card = room.cards.get(cardId)
  if (!card || !canEditCard(room, participantId, card)) return false

  room.cards.delete(cardId)
  await persistRoom(room)
  return true
}

export async function moveCard(
  roomId: string,
  participantId: string,
  cardId: string,
  columnId: ColumnId,
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room) return false

  const card = room.cards.get(cardId)
  if (!card || !canEditCard(room, participantId, card)) return false
  if (!columnExists(room, columnId)) return false

  card.columnId = columnId
  await persistRoom(room)
  return true
}

export async function voteCard(
  roomId: string,
  participantId: string,
  cardId: string,
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room || room.phase !== 'vote') return false
  if (!room.participants.has(participantId)) return false

  const card = room.cards.get(cardId)
  if (!card) return false

  if (!card.votes.includes(participantId)) {
    card.votes.push(participantId)
  }

  await persistRoom(room)
  return true
}

export async function unvoteCard(
  roomId: string,
  participantId: string,
  cardId: string,
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room || room.phase !== 'vote') return false

  const card = room.cards.get(cardId)
  if (!card) return false

  card.votes = card.votes.filter((id) => id !== participantId)
  await persistRoom(room)
  return true
}

export async function groupCards(
  roomId: string,
  participantId: string,
  cardIds: string[],
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room || room.phase !== 'discuss') return false
  if (!isFacilitator(room, participantId)) return false
  if (cardIds.length < 2) return false

  const cards = cardIds.map((id) => room.cards.get(id)).filter(Boolean) as StickyCard[]
  if (cards.length < 2) return false

  const columnId = cards[0].columnId
  if (!cards.every((c) => c.columnId === columnId)) return false

  const groupId = randomUUID()
  const survivor = cards[0]
  const mergedSnapshots: MergedCardSnapshot[] = cards.map((c) => ({
    id: c.id,
    columnId: c.columnId,
    text: c.text,
    emoji: c.emoji,
    authorId: c.authorId,
    votes: [...c.votes],
    reactions: { ...(c.reactions ?? {}) },
    comments: (c.comments ?? []).map(normalizeComment),
    createdAt: c.createdAt,
  }))

  const allVotes = new Set<string>()
  for (const c of cards) {
    for (const v of c.votes) allVotes.add(v)
  }

  survivor.text = cards.map((c) => c.text).join('\n---\n')
  survivor.votes = [...allVotes]
  survivor.reactions = mergeReactions(cards)
  survivor.comments = mergeComments(cards)
  survivor.groupId = groupId
  survivor.mergedFrom = mergedSnapshots

  for (let i = 1; i < cards.length; i++) {
    room.cards.delete(cards[i].id)
  }

  await persistRoom(room)
  return true
}

export async function ungroupCard(
  roomId: string,
  participantId: string,
  cardId: string,
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room || room.phase !== 'discuss') return false
  if (!isFacilitator(room, participantId)) return false

  const card = room.cards.get(cardId)
  if (!card?.mergedFrom || card.mergedFrom.length < 2) return false

  for (const snapshot of card.mergedFrom) {
    room.cards.set(snapshot.id, normalizeCard({
      id: snapshot.id,
      columnId: snapshot.columnId,
      text: snapshot.text,
      emoji: snapshot.emoji,
      authorId: snapshot.authorId,
      groupId: null,
      votes: [...snapshot.votes],
      reactions: { ...(snapshot.reactions ?? {}) },
      comments: (snapshot.comments ?? []).map(normalizeComment),
      createdAt: snapshot.createdAt,
    }))
  }

  room.cards.delete(cardId)
  await persistRoom(room)
  return true
}

export async function setPhase(
  roomId: string,
  participantId: string,
  phase: RetroPhase,
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room || !isFacilitator(room, participantId)) return false

  room.phase = phase
  if (phase !== 'vote') {
    for (const card of room.cards.values()) {
      // keep votes during discuss/done for display
    }
  }

  await persistRoom(room)
  return true
}

export async function startTimer(
  roomId: string,
  participantId: string,
  durationSec: number,
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room || !isFacilitator(room, participantId)) return false
  if (durationSec < 1 || durationSec > 3600) return false

  room.timerDurationSec = durationSec
  room.timerEndsAt = Date.now() + durationSec * 1000
  await persistRoom(room)
  return true
}

export async function stopTimer(roomId: string, participantId: string): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room || !isFacilitator(room, participantId)) return false

  room.timerEndsAt = null
  room.timerDurationSec = null
  await persistRoom(room)
  return true
}

export async function addColumn(
  roomId: string,
  participantId: string,
  label: string,
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room || room.phase !== 'collect') return false
  if (!isFacilitator(room, participantId)) return false
  if (room.columns.length >= MAX_COLUMNS) return false

  const trimmed = label.trim()
  if (!trimmed) return false

  room.columns.push({ id: randomUUID(), label: trimmed })
  await persistRoom(room)
  return true
}

export async function removeColumn(
  roomId: string,
  participantId: string,
  columnId: string,
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room || room.phase !== 'collect') return false
  if (!isFacilitator(room, participantId)) return false
  if (room.columns.length <= MIN_COLUMNS) return false
  if (!columnExists(room, columnId)) return false

  room.columns = room.columns.filter((c) => c.id !== columnId)
  for (const [id, card] of room.cards) {
    if (card.columnId === columnId) {
      room.cards.delete(id)
    }
  }

  await persistRoom(room)
  return true
}

export async function updateRoomTitle(
  roomId: string,
  participantId: string,
  title: string,
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room) return false
  if (!isFacilitator(room, participantId)) return false

  room.title = title.trim().slice(0, MAX_ROOM_TITLE_LENGTH)
  await persistRoom(room)
  return true
}

export async function setCommentAuthorsVisible(
  roomId: string,
  participantId: string,
  visible: boolean,
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room) return false
  if (!isFacilitator(room, participantId)) return false

  room.showCommentAuthors = visible
  await persistRoom(room)
  return true
}

export async function renameColumn(
  roomId: string,
  participantId: string,
  columnId: string,
  label: string,
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room || room.phase !== 'collect') return false
  if (!isFacilitator(room, participantId)) return false

  const column = room.columns.find((c) => c.id === columnId)
  if (!column) return false

  const trimmed = label.trim()
  if (!trimmed) return false

  column.label = trimmed
  await persistRoom(room)
  return true
}

export async function toggleReaction(
  roomId: string,
  participantId: string,
  cardId: string,
  emoji: string,
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room || room.phase === 'done') return false
  if (!room.participants.has(participantId)) return false

  const trimmedEmoji = parseEmoji(emoji)
  if (!trimmedEmoji) return false

  const card = room.cards.get(cardId)
  if (!card) return false

  if (!card.reactions) card.reactions = {}

  card.reactions = toggleReactionMap(card.reactions, participantId, trimmedEmoji)

  await persistRoom(room)
  return true
}

export async function addCardComment(
  roomId: string,
  participantId: string,
  cardId: string,
  text: string,
  parentId?: string | null,
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room || !canInteractOnCard(room)) return false
  if (!room.participants.has(participantId)) return false

  const card = room.cards.get(cardId)
  if (!card) return false

  const trimmed = text.trim()
  if (!trimmed || trimmed.length > MAX_COMMENT_LENGTH) return false

  if (!card.comments) card.comments = []
  if (card.comments.length >= MAX_COMMENTS_PER_CARD) return false

  if (parentId) {
    const parent = findComment(card, parentId)
    if (!parent || parent.parentId !== null) return false
  }

  card.comments.push({
    id: randomUUID(),
    authorId: participantId,
    text: trimmed,
    parentId: parentId ?? null,
    likes: [],
    reactions: {},
    createdAt: Date.now(),
  })

  await persistRoom(room)
  return true
}

export async function toggleCommentLike(
  roomId: string,
  participantId: string,
  cardId: string,
  commentId: string,
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room || !canInteractOnCard(room)) return false
  if (!room.participants.has(participantId)) return false

  const card = room.cards.get(cardId)
  if (!card) return false

  const comment = findComment(card, commentId)
  if (!comment) return false

  const idx = comment.likes.indexOf(participantId)
  if (idx >= 0) {
    comment.likes.splice(idx, 1)
  } else {
    comment.likes.push(participantId)
  }

  await persistRoom(room)
  return true
}

export async function toggleCommentReaction(
  roomId: string,
  participantId: string,
  cardId: string,
  commentId: string,
  emoji: string,
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room || !canInteractOnCard(room)) return false
  if (!room.participants.has(participantId)) return false

  const trimmedEmoji = parseEmoji(emoji)
  if (!trimmedEmoji) return false

  const card = room.cards.get(cardId)
  if (!card) return false

  const comment = findComment(card, commentId)
  if (!comment) return false

  comment.reactions = toggleReactionMap(comment.reactions ?? {}, participantId, trimmedEmoji)

  await persistRoom(room)
  return true
}

export async function deleteCardComment(
  roomId: string,
  participantId: string,
  cardId: string,
  commentId: string,
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room || !canInteractOnCard(room)) return false

  const card = room.cards.get(cardId)
  if (!card?.comments) return false

  const comment = findComment(card, commentId)
  if (!comment) return false

  const canDelete =
    isFacilitator(room, participantId) || comment.authorId === participantId
  if (!canDelete) return false

  const replyIds = card.comments
    .filter((c) => c.parentId === commentId)
    .map((c) => c.id)
  const removeIds = new Set([commentId, ...replyIds])
  card.comments = card.comments.filter((c) => !removeIds.has(c.id))

  await persistRoom(room)
  return true
}

export function serializeRoom(room: Room, viewerId: string): ClientRoomState {
  const you = room.participants.get(viewerId)
  if (!you) {
    throw new Error('Participant not in room')
  }

  const isCreator = room.creatorId === viewerId
  const isFac = isFacilitator(room, viewerId)

  return {
    roomId: room.id,
    title: room.title,
    phase: room.phase,
    facilitatorId: room.facilitatorId,
    creatorId: room.creatorId,
    timerEndsAt: room.timerEndsAt,
    timerDurationSec: room.timerDurationSec,
    showCommentAuthors: room.showCommentAuthors,
    passwordProtected: isPasswordProtected(room),
    participantCount: room.participants.size,
    maxParticipants: MAX_PARTICIPANTS,
    you,
    isCreator,
    isFacilitator: isFac,
    canEditCards: room.phase === 'collect' || room.phase === 'discuss',
    canVote: room.phase === 'vote',
    canGroup: room.phase === 'discuss' && isFac,
    canManagePhase: isFac,
    canManageTimer: isFac,
    canManageColumns: room.phase === 'collect' && isFac,
    canReact: room.phase !== 'done',
    canComment: room.phase !== 'done',
    columns: room.columns,
    cards: [...room.cards.values()].map(normalizeCard).sort((a, b) => a.createdAt - b.createdAt),
    participants: [...room.participants.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  }
}
