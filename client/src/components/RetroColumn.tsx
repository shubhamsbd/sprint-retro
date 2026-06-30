import { useState, type FormEvent } from 'react'
import {
  CARD_EMOJIS,
  columnComposePlaceholder,
  columnEmptyState,
  columnHeaderClass,
  columnIcon,
  columnStyleClass,
  columnZoneClass,
  stickyTiltClass,
  type ClientRoomState,
  type ColumnId,
  type Participant,
  type RetroColumnDef,
  type StickyCard as StickyCardType,
} from '../types'
import { EmojiPicker } from './EmojiPicker'
import { StickyCard } from './StickyCard'

interface RetroColumnProps {
  column: RetroColumnDef
  columnIndex: number
  room: ClientRoomState
  participantsById: Map<string, Participant>
  selectedCardIds: Set<string>
  enteringCardIds: Set<string>
  onSelectCard: (cardId: string) => void
  onAddCard: (columnId: ColumnId, text: string, emoji?: string) => void
  onUpdateCard: (cardId: string, text: string, emoji?: string | null) => void
  onDeleteCard: (cardId: string) => void
  onVoteCard: (cardId: string) => void
  onUnvoteCard: (cardId: string) => void
  onUngroupCard: (cardId: string) => void
  onToggleReaction: (cardId: string, emoji: string) => void
  onAddComment: (cardId: string, text: string, parentId?: string | null) => void
  onToggleCommentLike: (cardId: string, commentId: string) => void
  onToggleCommentReaction: (cardId: string, commentId: string, emoji: string) => void
  onDeleteComment: (cardId: string, commentId: string) => void
  onRemoveColumn?: (columnId: string) => void
  onRenameColumn?: (columnId: string, label: string) => void
}

export function RetroColumn({
  column,
  columnIndex,
  room,
  participantsById,
  selectedCardIds,
  enteringCardIds,
  onSelectCard,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onVoteCard,
  onUnvoteCard,
  onUngroupCard,
  onToggleReaction,
  onAddComment,
  onToggleCommentLike,
  onToggleCommentReaction,
  onDeleteComment,
  onRemoveColumn,
  onRenameColumn,
}: RetroColumnProps) {
  const [draft, setDraft] = useState('')
  const [draftEmoji, setDraftEmoji] = useState<string | undefined>()
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameDraft, setRenameDraft] = useState(column.label)
  const cards = room.cards.filter((c) => c.columnId === column.id)
  const columnClass = columnStyleClass(columnIndex)
  const headerClass = columnHeaderClass(columnIndex)
  const zoneClass = columnZoneClass(columnIndex)
  const icon = columnIcon(columnIndex)
  const isCollect = room.phase === 'collect'
  const emptyState = columnEmptyState(column, columnIndex, isCollect)

  function handleAdd(event: FormEvent) {
    event.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed || room.phase !== 'collect') return
    onAddCard(column.id, trimmed, draftEmoji)
    setDraft('')
    setDraftEmoji(undefined)
  }

  function saveRename() {
    const trimmed = renameDraft.trim()
    if (!trimmed || trimmed === column.label) {
      setRenaming(false)
      setRenameDraft(column.label)
      return
    }
    onRenameColumn?.(column.id, trimmed)
    setRenaming(false)
  }

  return (
    <div className={`column-board ${zoneClass} flex min-h-[440px] flex-col`}>
      <div className={`h-1.5 shrink-0 ${headerClass}`} />

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {renaming ? (
              <div className="flex min-w-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <input
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  className="input-field min-w-0 flex-1 rounded-lg px-2 py-1.5 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveRename()
                    if (e.key === 'Escape') {
                      setRenaming(false)
                      setRenameDraft(column.label)
                    }
                  }}
                />
                <button type="button" onClick={saveRename} className="btn-primary rounded-lg px-2.5 py-1.5 text-xs">
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="column-icon-glow flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-base">
                  {icon}
                </span>
                <h2 className="text-sm font-bold leading-tight text-on-dark">{column.label}</h2>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <span className="count-pill">{cards.length}</span>
            {onRenameColumn && !renaming && (
              <button
                type="button"
                onClick={() => {
                  setRenameDraft(column.label)
                  setRenaming(true)
                }}
                className="rounded-lg p-1 text-subtle transition hover:bg-white/10 hover:text-brand-yellow-light"
                title="Rename column"
                aria-label={`Rename ${column.label} column`}
              >
                ✎
              </button>
            )}
            {onRemoveColumn && (
              <button
                type="button"
                onClick={() => onRemoveColumn(column.id)}
                className="rounded-lg p-1 text-subtle transition hover:bg-red-950/50 hover:text-red-400"
                title="Remove column"
                aria-label={`Remove ${column.label} column`}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="column-card-stack flex flex-1 flex-col gap-2.5 overflow-y-auto pb-1">
          {cards.length === 0 && !isCollect && (
            <div className="empty-column flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
              <span className="empty-column-icon mb-2 text-2xl opacity-80">{emptyState.icon}</span>
              <p className="text-subtle text-xs leading-relaxed">{emptyState.text}</p>
            </div>
          )}

          {cards.map((card: StickyCardType, cardIndex) => (
            <StickyCard
              key={card.id}
              card={card}
              cardIndex={cardIndex}
              author={participantsById.get(card.authorId)}
              youId={room.you.id}
              isFacilitator={room.isFacilitator}
              canEdit={room.canEditCards}
              canVote={room.canVote}
              canGroup={room.canGroup}
              canReact={room.canReact}
              isNew={enteringCardIds.has(card.id)}
              selected={selectedCardIds.has(card.id)}
              onSelect={onSelectCard}
              onUpdate={onUpdateCard}
              onDelete={onDeleteCard}
              onVote={onVoteCard}
              onUnvote={onUnvoteCard}
              onUngroup={onUngroupCard}
              onToggleReaction={onToggleReaction}
              onAddComment={onAddComment}
              onToggleCommentLike={onToggleCommentLike}
              onToggleCommentReaction={onToggleCommentReaction}
              onDeleteComment={onDeleteComment}
              participantsById={participantsById}
              canComment={room.canComment}
              columnClass={`${columnClass} ${stickyTiltClass(cardIndex)}`}
            />
          ))}

          {cards.length === 0 && isCollect && (
            <div className="empty-column px-4 py-6 text-center">
              <span className="empty-column-icon mb-2 block text-2xl">{emptyState.icon}</span>
              <p className="text-subtle text-xs leading-relaxed">{emptyState.text}</p>
            </div>
          )}
        </div>

        {isCollect && (
          <form onSubmit={handleAdd} className="compose-box relative mt-4 p-3">
            <div className="mb-2 flex items-start gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((open) => !open)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-lg shadow-sm transition hover:scale-110 hover:border-brand-yellow/40"
                  title="Add emoji"
                >
                  {draftEmoji ?? '🙂'}
                </button>
                {showEmojiPicker && (
                  <EmojiPicker
                    emojis={CARD_EMOJIS}
                    onSelect={(emoji) => {
                      setDraftEmoji(emoji)
                      setShowEmojiPicker(false)
                    }}
                    onClose={() => setShowEmojiPicker(false)}
                    className="absolute bottom-full left-0 z-20 mb-1 w-48"
                  />
                )}
              </div>
              {draftEmoji && (
                <button
                  type="button"
                  onClick={() => setDraftEmoji(undefined)}
                  className="text-subtle self-center text-xs hover:text-on-dark"
                >
                  Clear
                </button>
              )}
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={columnComposePlaceholder(column)}
              rows={2}
              className="input-field mb-2 w-full rounded-xl px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="btn-primary btn-add-card w-full rounded-xl px-3 py-2.5 text-sm disabled:opacity-50"
            >
              ＋ Add card
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
