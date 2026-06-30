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
  showCommentAuthors: boolean
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
  showCommentAuthors,
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
      className={`sticky-card ${columnClass} group relative transition ${
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
        <div className="sticky-card-inner space-y-2" onClick={(e) => e.stopPropagation()}>
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
            className="input-field w-full rounded-lg px-3 py-2 text-sm leading-relaxed"
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
        <div className="sticky-card-inner">
          <div className="sticky-card-content">
            {card.emoji && <span className="sticky-card-emoji">{card.emoji}</span>}
            <p className="sticky-card-text whitespace-pre-wrap">{card.text}</p>
          </div>

          <div className="sticky-card-meta">
            <div className="sticky-card-author">
              {showCommentAuthors ? (
                <>
                  {author && <UserAvatar avatar={author.avatar} size="sm" />}
                  <span>{author?.name ?? 'Unknown'}</span>
                </>
              ) : (
                <span className="text-subtle text-[10px] font-semibold uppercase tracking-wide">Anonymous</span>
              )}
            </div>
            {card.votes.length > 0 && (
              <span className="sticky-card-votes">
                ▲ {card.votes.length}
              </span>
            )}
          </div>

          {(reactions.length > 0 || canReact) && (
            <div
              className="sticky-card-reactions"
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
                    className={`sticky-card-reaction ${reacted ? 'sticky-card-reaction-active' : ''}`}
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
                    className="sticky-card-reaction-add"
                    title="Add reaction"
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
            <span className="sticky-card-grouped-badge">Grouped · {card.mergedFrom.length} cards</span>
          )}

          <CardComments
            cardId={card.id}
            comments={card.comments ?? []}
            participantsById={participantsById}
            youId={youId}
            isFacilitator={isFacilitator}
            canComment={canComment}
            showCommentAuthors={showCommentAuthors}
            onAddComment={onAddComment}
            onToggleCommentLike={onToggleCommentLike}
            onToggleCommentReaction={onToggleCommentReaction}
            onDeleteComment={onDeleteComment}
          />
        </div>
      )}

      {(canModify || (isFacilitator && card.mergedFrom)) && !editing && (
        <div
          className="sticky-card-actions"
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
                className="sticky-card-action-btn"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(card.id)}
                className="sticky-card-action-btn sticky-card-action-btn-danger"
              >
                Delete
              </button>
            </>
          )}
          {isFacilitator && card.mergedFrom && (
            <button
              type="button"
              onClick={() => onUngroup(card.id)}
              className="sticky-card-action-btn"
            >
              Ungroup
            </button>
          )}
        </div>
      )}
    </div>
  )
}
