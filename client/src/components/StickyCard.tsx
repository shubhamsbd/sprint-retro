import { useState } from 'react'
import { CARD_EMOJIS, REACTION_EMOJIS, type Participant, type StickyCard as StickyCardType } from '../types'
import { CardComments } from './CardComments'
import { EmojiPicker } from './EmojiPicker'
import { UserAvatar } from './UserAvatar'

interface StickyCardProps {
  card: StickyCardType
  author: Participant | undefined
  youId: string
  isFacilitator: boolean
  canEdit: boolean
  canVote: boolean
  canGroup: boolean
  canReact: boolean
  isNew?: boolean
  selected: boolean
  onSelect: (cardId: string) => void
  onUpdate: (cardId: string, text: string, emoji?: string | null) => void
  onDelete: (cardId: string) => void
  onVote: (cardId: string) => void
  onUnvote: (cardId: string) => void
  onUngroup: (cardId: string) => void
  onToggleReaction: (cardId: string, emoji: string) => void
  onAddComment: (cardId: string, text: string, parentId?: string | null) => void
  onToggleCommentLike: (cardId: string, commentId: string) => void
  onToggleCommentReaction: (cardId: string, commentId: string, emoji: string) => void
  onDeleteComment: (cardId: string, commentId: string) => void
  participantsById: Map<string, Participant>
  canComment: boolean
  columnClass: string
  cardIndex?: number
}

export function StickyCard({
  card,
  author,
  youId,
  isFacilitator,
  canEdit,
  canVote,
  canGroup,
  canReact,
  isNew = false,
  selected,
  onSelect,
  onUpdate,
  onDelete,
  onVote,
  onUnvote,
  onUngroup,
  onToggleReaction,
  onAddComment,
  onToggleCommentLike,
  onToggleCommentReaction,
  onDeleteComment,
  participantsById,
  canComment,
  columnClass,
}: StickyCardProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(card.text)
  const [draftEmoji, setDraftEmoji] = useState<string | undefined>(card.emoji)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const hasVoted = card.votes.includes(youId)
  const canModify = canEdit && (isFacilitator || card.authorId === youId)
  const reactions = Object.entries(card.reactions ?? {}).sort((a, b) => b[1].length - a[1].length)

  function saveEdit() {
    const trimmed = draft.trim()
    if (trimmed && (trimmed !== card.text || draftEmoji !== card.emoji)) {
      onUpdate(card.id, trimmed, draftEmoji ?? null)
    }
    setEditing(false)
  }

  return (
    <div
      className={`sticky-card ${columnClass} group relative rounded-lg p-3 transition ${
        selected ? 'sticky-card-selected' : ''
      } ${isNew ? 'sticky-card-enter' : ''} ${canVote || canGroup ? 'cursor-pointer' : ''}`}
      onClick={() => {
        if (canVote) {
          hasVoted ? onUnvote(card.id) : onVote(card.id)
        } else if (canGroup) {
          onSelect(card.id)
        }
      }}
    >
      {editing ? (
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          <div className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEmojiPicker((open) => !open)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-black/10 bg-white text-base"
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
                className="absolute left-0 top-full z-20 mt-1 w-48"
              />
            )}
            {draftEmoji && (
              <button
                type="button"
                onClick={() => setDraftEmoji(undefined)}
                className="text-subtle text-xs hover:text-brand-black"
              >
                Clear
              </button>
            )}
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="input-field w-full rounded-md px-2 py-1 text-sm"
            rows={3}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveEdit}
              className="btn-primary rounded-md px-2 py-1 text-xs"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(card.text)
                setDraftEmoji(card.emoji)
                setEditing(false)
              }}
              className="btn-secondary rounded-md px-2 py-1 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm text-brand-black">
            {card.emoji && <span className="mr-1.5">{card.emoji}</span>}
            {card.text}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {author && <UserAvatar avatar={author.avatar} size="sm" />}
              <span className="text-subtle text-xs">{author?.name ?? 'Unknown'}</span>
            </div>
            {card.votes.length > 0 && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-brand-yellow-dark">
                {card.votes.length} vote{card.votes.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {(reactions.length > 0 || canReact) && (
            <div
              className="relative mt-2 flex flex-wrap items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {reactions.map(([emoji, participantIds]) => {
                const reacted = participantIds.includes(youId)
                return (
                  <button
                    key={emoji}
                    type="button"
                    disabled={!canReact}
                    onClick={() => onToggleReaction(card.id, emoji)}
                    className={`rounded-full border px-2 py-0.5 text-xs transition ${
                      reacted
                        ? 'border-brand-yellow/40 bg-amber-50 text-brand-yellow-dark'
                        : 'border-black/10 bg-white/70 text-brand-black hover:bg-white'
                    } disabled:cursor-default`}
                  >
                    {emoji} {participantIds.length}
                  </button>
                )
              })}
              {canReact && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowReactionPicker((open) => !open)}
                    className="rounded-full border border-dashed border-black/15 bg-white/70 px-2 py-0.5 text-xs text-subtle hover:text-brand-black"
                  >
                    +
                  </button>
                  {showReactionPicker && (
                    <EmojiPicker
                      emojis={REACTION_EMOJIS}
                      onSelect={(emoji) => {
                        onToggleReaction(card.id, emoji)
                        setShowReactionPicker(false)
                      }}
                      onClose={() => setShowReactionPicker(false)}
                      className="absolute bottom-full left-0 z-20 mb-1 w-48"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {card.mergedFrom && (
            <span className="text-subtle mt-1 block text-[10px]">Grouped ({card.mergedFrom.length} cards)</span>
          )}

          <CardComments
            cardId={card.id}
            comments={card.comments ?? []}
            participantsById={participantsById}
            youId={youId}
            isFacilitator={isFacilitator}
            canComment={canComment}
            onAddComment={onAddComment}
            onToggleCommentLike={onToggleCommentLike}
            onToggleCommentReaction={onToggleCommentReaction}
            onDeleteComment={onDeleteComment}
          />
        </>
      )}

      {(canModify || (isFacilitator && card.mergedFrom)) && !editing && (
        <div
          className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          {canModify && (
            <>
              <button
                type="button"
                onClick={() => {
                  setDraft(card.text)
                  setDraftEmoji(card.emoji)
                  setEditing(true)
                }}
                className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-brand-black shadow"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(card.id)}
                className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-red-600 shadow"
              >
                Delete
              </button>
            </>
          )}
          {isFacilitator && card.mergedFrom && (
            <button
              type="button"
              onClick={() => onUngroup(card.id)}
              className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-brand-yellow-dark shadow"
            >
              Ungroup
            </button>
          )}
        </div>
      )}
    </div>
  )
}
