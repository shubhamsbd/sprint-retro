import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useRoomActivity } from '../hooks/useRoomActivity'
import { getRetroDisplayTitle } from '../lib/export'
import { getRoomInviteUrl } from '../lib/urls'
import { GRID_COLS_CLASS, PHASE_ICONS, PHASE_LABELS, type ClientRoomState, type ColumnId } from '../types'
import { ActivityToastStack } from './ActivityToastStack'
import { ExportSummaryModal } from './ExportSummaryModal'
import { FacilitatorToolbar } from './FacilitatorToolbar'
import { ParticipantBar } from './ParticipantBar'
import { RetroColumn } from './RetroColumn'

interface RetroBoardProps {
  room: ClientRoomState
  onAddCard: (columnId: ColumnId, text: string, emoji?: string) => void
  onUpdateCard: (cardId: string, text: string, emoji?: string | null) => void
  onDeleteCard: (cardId: string) => void
  onVoteCard: (cardId: string) => void
  onUnvoteCard: (cardId: string) => void
  onGroupCards: (cardIds: string[]) => void
  onUngroupCard: (cardId: string) => void
  onAddColumn: (label: string) => void
  onRemoveColumn: (columnId: string) => void
  onRenameColumn: (columnId: string, label: string) => void
  onUpdateTitle: (title: string) => void
  onToggleReaction: (cardId: string, emoji: string) => void
  onAddComment: (cardId: string, text: string, parentId?: string | null) => void
  onToggleCommentLike: (cardId: string, commentId: string) => void
  onToggleCommentReaction: (cardId: string, commentId: string, emoji: string) => void
  onDeleteComment: (cardId: string, commentId: string) => void
  onSetPhase: (phase: ClientRoomState['phase']) => void
  onStartTimer: (durationSec: number) => void
  onStopTimer: () => void
  onAssignFacilitator: (facilitatorId: string) => void
  onCloseRoom: () => void
  onLeave: () => void
}

export function RetroBoard({
  room,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onVoteCard,
  onUnvoteCard,
  onGroupCards,
  onUngroupCard,
  onAddColumn,
  onRemoveColumn,
  onRenameColumn,
  onUpdateTitle,
  onToggleReaction,
  onAddComment,
  onToggleCommentLike,
  onToggleCommentReaction,
  onDeleteComment,
  onSetPhase,
  onStartTimer,
  onStopTimer,
  onAssignFacilitator,
  onCloseRoom,
  onLeave,
}: RetroBoardProps) {
  const [showExport, setShowExport] = useState(false)
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set())
  const [copiedInvite, setCopiedInvite] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(room.title)

  useEffect(() => {
    if (!editingTitle) {
      setTitleDraft(room.title)
    }
  }, [room.title, editingTitle])
  const [showAddColumn, setShowAddColumn] = useState(false)
  const [newColumnLabel, setNewColumnLabel] = useState('')
  const [enteringCardIds, setEnteringCardIds] = useState<Set<string>>(new Set())
  const prevCardIdsRef = useRef<Set<string>>(new Set())
  const { toasts, dismissToast } = useRoomActivity(room)

  const participantsById = useMemo(
    () => new Map(room.participants.map((p) => [p.id, p])),
    [room.participants],
  )

  useEffect(() => {
    const currentIds = new Set(room.cards.map((c) => c.id))
    const newIds = room.cards.filter((c) => !prevCardIdsRef.current.has(c.id)).map((c) => c.id)

    if (newIds.length > 0 && prevCardIdsRef.current.size > 0) {
      setEnteringCardIds(new Set(newIds))
      const timer = window.setTimeout(() => setEnteringCardIds(new Set()), 500)
      prevCardIdsRef.current = currentIds
      return () => window.clearTimeout(timer)
    }

    prevCardIdsRef.current = currentIds
  }, [room.cards])

  const gridClass = GRID_COLS_CLASS[room.columns.length] ?? 'md:grid-cols-3'
  const canAddColumn = room.canManageColumns && room.columns.length < 6

  function toggleSelect(cardId: string) {
    if (!room.canGroup) return
    const card = room.cards.find((c) => c.id === cardId)
    if (!card) return

    setSelectedCardIds((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) {
        next.delete(cardId)
        return next
      }

      if (next.size > 0) {
        const firstId = next.values().next().value!
        const firstCard = room.cards.find((c) => c.id === firstId)
        if (firstCard && firstCard.columnId !== card.columnId) {
          return next
        }
      }

      next.add(cardId)
      return next
    })
  }

  function handleGroupSelected() {
    if (selectedCardIds.size < 2) return
    onGroupCards([...selectedCardIds])
    setSelectedCardIds(new Set())
  }

  function handleAddColumn(event: FormEvent) {
    event.preventDefault()
    const trimmed = newColumnLabel.trim()
    if (!trimmed) return
    onAddColumn(trimmed)
    setNewColumnLabel('')
    setShowAddColumn(false)
  }

  function handleRemoveColumn(columnId: string) {
    const column = room.columns.find((c) => c.id === columnId)
    const cardCount = room.cards.filter((c) => c.columnId === columnId).length
    const message =
      cardCount > 0
        ? `Remove "${column?.label}" and its ${cardCount} card${cardCount === 1 ? '' : 's'}?`
        : `Remove "${column?.label}"?`
    if (window.confirm(message)) {
      onRemoveColumn(columnId)
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(getRoomInviteUrl(room.roomId))
      setCopiedInvite(true)
      setTimeout(() => setCopiedInvite(false), 2000)
    } catch {
      // ignore
    }
  }

  const phaseHint =
    room.phase === 'discuss' && room.isFacilitator
      ? 'Select 2+ cards in the same column, then click "Group cards" to merge them.'
      : room.phase === 'vote'
        ? 'Click cards to vote. Click again to remove your vote.'
        : room.canManageColumns
          ? 'As facilitator, customize columns — add, rename, or remove them during Collect.'
          : room.canComment
            ? 'Expand comments on cards to discuss, reply, like, or react.'
            : null

  const displayTitle = getRetroDisplayTitle(room)

  function commitTitle() {
    const trimmed = titleDraft.trim()
    if (trimmed !== room.title) {
      onUpdateTitle(trimmed)
    }
    setEditingTitle(false)
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitTitle()
    }
    if (event.key === 'Escape') {
      setTitleDraft(room.title)
      setEditingTitle(false)
    }
  }

  return (
    <div className="retro-page mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6">
      <header className="board-header mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4 sm:px-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-brand-yellow/35 bg-gradient-to-br from-amber-500/30 to-yellow-600/20 text-2xl shadow-[0_0_24px_rgba(234,179,8,0.2)]">
            🔄
          </div>
          <div>
            <p className="text-subtle text-[10px] font-semibold uppercase tracking-[0.2em]">Sprint retrospective</p>
            {editingTitle && room.isFacilitator ? (
              <input
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={commitTitle}
                onKeyDown={handleTitleKeyDown}
                maxLength={80}
                autoFocus
                placeholder="Sprint name or retro title"
                className="input-field mt-1 w-full max-w-md rounded-xl px-3 py-2 text-2xl font-bold tracking-tight sm:text-3xl"
              />
            ) : (
              <div className="mt-1 flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-on-dark sm:text-3xl">{displayTitle}</h1>
                {room.isFacilitator && (
                  <button
                    type="button"
                    onClick={() => {
                      setTitleDraft(room.title)
                      setEditingTitle(true)
                    }}
                    className="text-subtle rounded-lg px-2 py-1 text-xs hover:bg-white/10 hover:text-on-dark"
                    title="Edit retro title"
                  >
                    ✏️
                  </button>
                )}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="room-code-chip rounded-full px-2.5 py-1 font-mono text-xs font-semibold">
                {room.roomId}
              </span>
              <span className="text-muted text-xs">
                {room.participantCount}/{room.maxParticipants} participants
              </span>
              <span className="badge-live inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
                {room.phase !== 'done' && <span className="badge-live-dot" aria-hidden />}
                {PHASE_ICONS[room.phase]} {PHASE_LABELS[room.phase]}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void copyInvite()} className="btn-secondary rounded-xl px-4 py-2 text-sm">
            {copiedInvite ? '✓ Copied!' : 'Copy invite link'}
          </button>
          <button type="button" onClick={() => void onLeave()} className="btn-secondary rounded-xl px-4 py-2 text-sm">
            Leave room
          </button>
        </div>
      </header>

      <FacilitatorToolbar
        room={room}
        onSetPhase={onSetPhase}
        onStartTimer={onStartTimer}
        onStopTimer={onStopTimer}
        onExport={() => setShowExport(true)}
        onCloseRoom={onCloseRoom}
        onAssignFacilitator={onAssignFacilitator}
        onGroupSelected={handleGroupSelected}
        selectedCount={selectedCardIds.size}
      />

      <div className="mb-5">
        <ParticipantBar
          participants={room.participants}
          facilitatorId={room.facilitatorId}
          youId={room.you.id}
        />
      </div>

      {phaseHint && (
        <div className="hint-banner mb-5 flex items-start gap-3 rounded-2xl px-4 py-3">
          <span className="text-lg leading-none">💡</span>
          <p className="text-muted text-sm leading-relaxed">{phaseHint}</p>
        </div>
      )}

      <div className={`grid gap-5 ${gridClass}`}>
        {room.columns.map((column, index) => (
          <RetroColumn
            key={column.id}
            column={column}
            columnIndex={index}
            room={room}
            participantsById={participantsById}
            selectedCardIds={selectedCardIds}
            enteringCardIds={enteringCardIds}
            onSelectCard={toggleSelect}
            onAddCard={onAddCard}
            onUpdateCard={onUpdateCard}
            onDeleteCard={onDeleteCard}
            onVoteCard={onVoteCard}
            onUnvoteCard={onUnvoteCard}
            onUngroupCard={onUngroupCard}
            onToggleReaction={onToggleReaction}
            onAddComment={onAddComment}
            onToggleCommentLike={onToggleCommentLike}
            onToggleCommentReaction={onToggleCommentReaction}
            onDeleteComment={onDeleteComment}
            onRemoveColumn={
              room.canManageColumns && room.columns.length > 1 ? handleRemoveColumn : undefined
            }
            onRenameColumn={room.canManageColumns ? onRenameColumn : undefined}
          />
        ))}
      </div>

      {canAddColumn && (
        <div className="mt-5">
          {showAddColumn ? (
            <form onSubmit={handleAddColumn} className="compose-box flex flex-wrap items-end gap-3 p-4">
              <div className="min-w-[200px] flex-1">
                <label htmlFor="new-column-label" className="text-subtle mb-1.5 block text-xs font-medium">
                  New column name
                </label>
                <input
                  id="new-column-label"
                  value={newColumnLabel}
                  onChange={(e) => setNewColumnLabel(e.target.value)}
                  placeholder="e.g. Shout-outs"
                  className="input-field w-full rounded-xl px-3 py-2.5 text-sm"
                  autoFocus
                />
              </div>
              <button type="submit" disabled={!newColumnLabel.trim()} className="btn-primary rounded-xl px-5 py-2.5 text-sm">
                Add column
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddColumn(false)
                  setNewColumnLabel('')
                }}
                className="btn-secondary rounded-xl px-5 py-2.5 text-sm"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddColumn(true)}
              className="add-column-btn w-full rounded-2xl px-4 py-4 text-sm font-medium"
            >
              + Add another column
            </button>
          )}
        </div>
      )}

      {showExport && <ExportSummaryModal room={room} onClose={() => setShowExport(false)} />}
      <ActivityToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
