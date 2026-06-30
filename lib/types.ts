export interface RetroColumnDef {
  id: string
  label: string
  isActionItems?: boolean
}

export const DEFAULT_COLUMNS: RetroColumnDef[] = [
  { id: 'went_well', label: 'What went well' },
  { id: 'to_improve', label: 'What to improve' },
  { id: 'action_items', label: 'Action items', isActionItems: true },
]

export type ColumnId = string

export type CardReactions = Record<string, string[]>

export interface CardComment {
  id: string
  authorId: string
  text: string
  parentId: string | null
  likes: string[]
  reactions: CardReactions
  createdAt: number
}

export const CARD_EMOJIS = [
  '👍',
  '👎',
  '❤️',
  '🎉',
  '🤔',
  '👀',
  '🔥',
  '✅',
  '❌',
  '💡',
  '🚀',
  '⭐',
  '💪',
  '🙌',
  '😊',
  '😅',
  '⚠️',
  '🐛',
] as const

export const REACTION_EMOJIS = CARD_EMOJIS

export type RetroPhase = 'collect' | 'vote' | 'discuss' | 'done'

export interface Avatar {
  emoji: string
  color: string
}

export interface Participant {
  id: string
  name: string
  avatar: Avatar
}

export interface MergedCardSnapshot {
  id: string
  columnId: ColumnId
  text: string
  emoji?: string
  authorId: string
  votes: string[]
  reactions?: CardReactions
  comments?: CardComment[]
  createdAt: number
}

export interface StickyCard {
  id: string
  columnId: ColumnId
  text: string
  emoji?: string
  authorId: string
  groupId: string | null
  votes: string[]
  reactions?: CardReactions
  comments?: CardComment[]
  createdAt: number
  mergedFrom?: MergedCardSnapshot[]
}

export interface RoomState {
  roomId: string
  title: string
  phase: RetroPhase
  facilitatorId: string | null
  creatorId: string
  timerEndsAt: number | null
  timerDurationSec: number | null
  passwordProtected: boolean
  participantCount: number
  maxParticipants: number
  columns: RetroColumnDef[]
  cards: StickyCard[]
  participants: Participant[]
}

export interface ClientRoomState extends RoomState {
  you: Participant
  isCreator: boolean
  isFacilitator: boolean
  canEditCards: boolean
  canVote: boolean
  canGroup: boolean
  canManagePhase: boolean
  canManageTimer: boolean
  canManageColumns: boolean
  canReact: boolean
  canComment: boolean
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

export interface SessionPayload {
  roomId: string
  participantId: string
  state: ClientRoomState
}

export interface RoomPublicInfo {
  roomId: string
  title: string
  passwordProtected: boolean
  participantCount: number
  maxParticipants: number
  isFull: boolean
}
