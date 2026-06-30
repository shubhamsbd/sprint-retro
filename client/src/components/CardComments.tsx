import { useMemo, useState, type FormEvent } from 'react'
import { REACTION_EMOJIS, type CardComment, type Participant } from '../types'
import { EmojiPicker } from './EmojiPicker'
import { UserAvatar } from './UserAvatar'

interface CardCommentsProps {
  cardId: string
  comments: CardComment[]
  participantsById: Map<string, Participant>
  youId: string
  isFacilitator: boolean
  canComment: boolean
  onAddComment: (cardId: string, text: string, parentId?: string | null) => void
  onToggleCommentLike: (cardId: string, commentId: string) => void
  onToggleCommentReaction: (cardId: string, commentId: string, emoji: string) => void
  onDeleteComment: (cardId: string, commentId: string) => void
}

interface CommentItemProps {
  comment: CardComment
  replies: CardComment[]
  cardId: string
  participantsById: Map<string, Participant>
  youId: string
  isFacilitator: boolean
  canComment: boolean
  onAddComment: CardCommentsProps['onAddComment']
  onToggleCommentLike: CardCommentsProps['onToggleCommentLike']
  onToggleCommentReaction: CardCommentsProps['onToggleCommentReaction']
  onDeleteComment: CardCommentsProps['onDeleteComment']
  isReply?: boolean
}

function CommentItem({
  comment,
  replies,
  cardId,
  participantsById,
  youId,
  isFacilitator,
  canComment,
  onAddComment,
  onToggleCommentLike,
  onToggleCommentReaction,
  onDeleteComment,
  isReply = false,
}: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyDraft, setReplyDraft] = useState('')
  const [showReactionPicker, setShowReactionPicker] = useState(false)

  const author = participantsById.get(comment.authorId)
  const liked = comment.likes.includes(youId)
  const canDelete = canComment && (isFacilitator || comment.authorId === youId)
  const reactions = Object.entries(comment.reactions ?? {}).sort((a, b) => b[1].length - a[1].length)

  function submitReply(event: FormEvent) {
    event.preventDefault()
    const trimmed = replyDraft.trim()
    if (!trimmed) return
    onAddComment(cardId, trimmed, comment.id)
    setReplyDraft('')
    setShowReplyForm(false)
  }

  return (
    <div className={isReply ? 'ml-4 border-l-2 border-brand-yellow/25 pl-3' : ''}>
      <div className="rounded-xl border border-black/6 bg-white/80 p-2.5">
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {author && <UserAvatar avatar={author.avatar} size="sm" />}
            <span className="truncate text-xs font-semibold text-brand-black">{author?.name ?? 'Unknown'}</span>
          </div>
          {canDelete && (
            <button
              type="button"
              onClick={() => onDeleteComment(cardId, comment.id)}
              className="text-subtle shrink-0 text-[10px] hover:text-red-600"
            >
              Delete
            </button>
          )}
        </div>

        <p className="whitespace-pre-wrap text-xs leading-relaxed text-brand-black">{comment.text}</p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={!canComment}
            onClick={() => onToggleCommentLike(cardId, comment.id)}
            className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
              liked
                ? 'border-brand-yellow/40 bg-amber-50 text-brand-yellow-dark'
                : 'border-black/10 bg-white text-subtle hover:text-brand-black'
            } disabled:cursor-default`}
          >
            👍 {comment.likes.length > 0 ? comment.likes.length : 'Like'}
          </button>

          {reactions.map(([emoji, participantIds]) => {
            const reacted = participantIds.includes(youId)
            return (
              <button
                key={emoji}
                type="button"
                disabled={!canComment}
                onClick={() => onToggleCommentReaction(cardId, comment.id, emoji)}
                className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                  reacted
                    ? 'border-brand-yellow/40 bg-amber-50 text-brand-yellow-dark'
                    : 'border-black/10 bg-white/80 text-brand-black hover:bg-white'
                } disabled:cursor-default`}
              >
                {emoji} {participantIds.length}
              </button>
            )
          })}

          {canComment && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowReactionPicker((open) => !open)}
                className="rounded-full border border-dashed border-black/15 bg-white/70 px-2 py-0.5 text-[11px] text-subtle hover:text-brand-black"
              >
                +
              </button>
              {showReactionPicker && (
                <EmojiPicker
                  emojis={REACTION_EMOJIS}
                  onSelect={(emoji) => {
                    onToggleCommentReaction(cardId, comment.id, emoji)
                    setShowReactionPicker(false)
                  }}
                  onClose={() => setShowReactionPicker(false)}
                  className="absolute bottom-full left-0 z-30 mb-1 w-44"
                />
              )}
            </div>
          )}

          {canComment && !isReply && (
            <button
              type="button"
              onClick={() => setShowReplyForm((open) => !open)}
              className="text-[11px] font-medium text-brand-yellow-dark hover:underline"
            >
              Reply
            </button>
          )}
        </div>

        {showReplyForm && (
          <form onSubmit={submitReply} className="mt-2 flex gap-1.5">
            <input
              value={replyDraft}
              onChange={(e) => setReplyDraft(e.target.value)}
              placeholder="Write a reply…"
              className="input-field min-w-0 flex-1 rounded-lg px-2 py-1 text-xs"
              autoFocus
            />
            <button type="submit" disabled={!replyDraft.trim()} className="btn-primary rounded-lg px-2 py-1 text-xs">
              Post
            </button>
          </form>
        )}
      </div>

      {replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              replies={[]}
              cardId={cardId}
              participantsById={participantsById}
              youId={youId}
              isFacilitator={isFacilitator}
              canComment={canComment}
              onAddComment={onAddComment}
              onToggleCommentLike={onToggleCommentLike}
              onToggleCommentReaction={onToggleCommentReaction}
              onDeleteComment={onDeleteComment}
              isReply
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function CardComments({
  cardId,
  comments,
  participantsById,
  youId,
  isFacilitator,
  canComment,
  onAddComment,
  onToggleCommentLike,
  onToggleCommentReaction,
  onDeleteComment,
}: CardCommentsProps) {
  const [expanded, setExpanded] = useState(comments.length > 0)
  const [draft, setDraft] = useState('')

  const { topLevel, repliesByParent } = useMemo(() => {
    const top = comments.filter((c) => !c.parentId).sort((a, b) => a.createdAt - b.createdAt)
    const byParent = new Map<string, CardComment[]>()
    for (const comment of comments) {
      if (!comment.parentId) continue
      const list = byParent.get(comment.parentId) ?? []
      list.push(comment)
      byParent.set(comment.parentId, list)
    }
    for (const list of byParent.values()) {
      list.sort((a, b) => a.createdAt - b.createdAt)
    }
    return { topLevel: top, repliesByParent: byParent }
  }, [comments])

  function submitComment(event: FormEvent) {
    event.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) return
    onAddComment(cardId, trimmed)
    setDraft('')
    setExpanded(true)
  }

  const totalCount = comments.length

  return (
    <div className="mt-3 border-t border-black/8 pt-2" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-left text-xs font-medium text-brand-yellow-dark hover:bg-white/50"
      >
        <span>💬 Comments{totalCount > 0 ? ` (${totalCount})` : ''}</span>
        <span className="text-subtle">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {topLevel.length === 0 && (
            <p className="text-subtle px-1 text-[11px]">No comments yet — start the discussion.</p>
          )}

          {topLevel.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              replies={repliesByParent.get(comment.id) ?? []}
              cardId={cardId}
              participantsById={participantsById}
              youId={youId}
              isFacilitator={isFacilitator}
              canComment={canComment}
              onAddComment={onAddComment}
              onToggleCommentLike={onToggleCommentLike}
              onToggleCommentReaction={onToggleCommentReaction}
              onDeleteComment={onDeleteComment}
            />
          ))}

          {canComment && (
            <form onSubmit={submitComment} className="compose-box flex gap-1.5 p-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add a comment…"
                className="input-field min-w-0 flex-1 rounded-lg px-2 py-1.5 text-xs"
              />
              <button type="submit" disabled={!draft.trim()} className="btn-primary rounded-lg px-3 py-1.5 text-xs">
                Post
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
