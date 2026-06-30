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

export const PHASE_LABELS: Record<RetroPhase, string> = {
  collect: 'Collect',
  vote: 'Vote',
  discuss: 'Discuss',
  done: 'Done',
}

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

export interface RoomPublicInfo {
  roomId: string
  title: string
  passwordProtected: boolean
  participantCount: number
  maxParticipants: number
  isFull: boolean
}

export interface SessionPayload {
  roomId: string
  participantId: string
  state: ClientRoomState
}

export function normalizeRoomState(state: ClientRoomState): ClientRoomState {
  const columns = state.columns?.length ? state.columns : [...DEFAULT_COLUMNS]
  const cards = state.cards.map((card) => ({
    ...card,
    reactions: card.reactions ?? {},
    comments: (card.comments ?? []).map((comment) => ({
      ...comment,
      likes: comment.likes ?? [],
      reactions: comment.reactions ?? {},
    })),
  }))
  return {
    ...state,
    title: state.title ?? '',
    columns,
    cards,
    canReact: state.canReact ?? state.phase !== 'done',
    canComment: state.canComment ?? state.phase !== 'done',
  }
}

export const COLUMN_STYLE_CLASSES = [
  'sticky-card-went-well',
  'sticky-card-to-improve',
  'sticky-card-action',
  'sticky-card-yellow',
] as const

export const COLUMN_ZONE_CLASSES = [
  'column-zone-green',
  'column-zone-rose',
  'column-zone-sky',
  'column-zone-amber',
  'column-zone-violet',
  'column-zone-gold',
] as const

export const COLUMN_HEADER_CLASSES = [
  'column-header-green',
  'column-header-rose',
  'column-header-sky',
  'column-header-amber',
  'column-header-violet',
  'column-header-gold',
] as const

export const COLUMN_ICONS = ['✨', '💡', '🎯', '📝', '🚀', '⭐'] as const

export const PHASE_ICONS: Record<RetroPhase, string> = {
  collect: '📝',
  vote: '👍',
  discuss: '💬',
  done: '✅',
}

export function columnStyleClass(index: number): string {
  return COLUMN_STYLE_CLASSES[index % COLUMN_STYLE_CLASSES.length]
}

export function columnZoneClass(index: number): string {
  return COLUMN_ZONE_CLASSES[index % COLUMN_ZONE_CLASSES.length]
}

export function columnHeaderClass(index: number): string {
  return COLUMN_HEADER_CLASSES[index % COLUMN_HEADER_CLASSES.length]
}

export function columnIcon(index: number): string {
  return COLUMN_ICONS[index % COLUMN_ICONS.length]
}

export function stickyTiltClass(index: number): string {
  const classes = ['sticky-card-tilt-a', 'sticky-card-tilt-b', 'sticky-card-tilt-c']
  return classes[index % classes.length]
}

export function columnEmptyState(
  column: RetroColumnDef,
  columnIndex: number,
  isCollect: boolean,
): { icon: string; text: string } {
  const icon = columnIcon(columnIndex)

  if (column.id === 'went_well') {
    return isCollect
      ? { icon: '✨', text: 'Add your first win from this sprint' }
      : { icon, text: 'No wins captured yet' }
  }
  if (column.id === 'to_improve') {
    return isCollect
      ? { icon: '⚡', text: 'What slowed you down?' }
      : { icon, text: 'Nothing flagged yet' }
  }
  if (column.id === 'action_items' || column.isActionItems) {
    return isCollect
      ? { icon: '🎯', text: 'Turn insights into next steps' }
      : { icon, text: 'No action items yet' }
  }

  return isCollect
    ? { icon: '📝', text: 'Start adding notes here' }
    : { icon, text: 'Empty for now' }
}

export function columnComposePlaceholder(column: RetroColumnDef): string {
  if (column.id === 'went_well') return 'Share a win…'
  if (column.id === 'to_improve') return 'What could be better?'
  if (column.id === 'action_items' || column.isActionItems) return 'Propose an action…'
  return `Add to ${column.label}…`
}

export const GRID_COLS_CLASS: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
  6: 'md:grid-cols-6',
}
