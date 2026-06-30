import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useRoomActivity } from '../hooks/useRoomActivity'
import { getRetroDisplayTitle } from '../lib/export'
import { getRoomInviteUrl } from '../lib/urls'
import { PHASE_ICONS, PHASE_LABELS, type ClientRoomState, type ColumnId } from '../types'
import { ActivityToastStack } from './ActivityToastStack'
import { ConfirmModal } from './ConfirmModal'
import { ExportSummaryModal } from './ExportSummaryModal'
import { FacilitatorToolbar, SessionTopActions } from './FacilitatorToolbar'
import { ParticipantBar } from './ParticipantBar'
import { PhaseStepper } from './PhaseStepper'
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
  onSetCommentAuthorsVisible: (visible: boolean) => void
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
  onSetCommentAuthorsVisible,
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
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string
    message: string
    confirmLabel: string
    onConfirm: () => void
  } | null>(null)
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
    if (!column) return

    const cardCount = room.cards.filter((c) => c.columnId === columnId).length
    const message =
      cardCount > 0
        ? `This will permanently remove "${column.label}" and its ${cardCount} card${cardCount === 1 ? '' : 's'}.`
        : `This will permanently remove the "${column.label}" column.`

    setConfirmDialog({
      title: 'Remove column',
      message,
      confirmLabel: 'Remove column',
      onConfirm: () => onRemoveColumn(columnId),
    })
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
    <div className="retro-page mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-3 py-4 sm:px-4 lg:h-dvh lg:max-h-dvh lg:min-h-0 lg:overflow-hidden lg:px-6 lg:py-5">
      <div className="board-layout flex min-h-0 flex-1 flex-col">
        <aside className="board-sidebar">
          <div className="sidebar-section">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/8 bg-brand-gray text-lg">
                🔄
              </div>
              <div className="min-w-0">
                <p className="text-subtle text-[10px] font-semibold uppercase tracking-[0.16em]">
                  Sprint retrospective
                </p>
                {editingTitle && room.isFacilitator ? (
                  <input
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    onBlur={commitTitle}
                    onKeyDown={handleTitleKeyDown}
                    maxLength={80}
                    autoFocus
                    placeholder="Retro title"
                    className="input-field mt-1 w-full rounded-lg px-2 py-1.5 text-base font-bold"
                  />
                ) : (
                  <div className="flex items-center gap-1">
                    <h1 className="truncate text-lg font-bold text-on-dark">{displayTitle}</h1>
                    {room.isFacilitator && (
                      <button
                        type="button"
                        onClick={() => {
                          setTitleDraft(room.title)
                          setEditingTitle(true)
                        }}
                        className="text-subtle shrink-0 rounded p-1 text-xs hover:bg-black/5"
                        title="Edit retro title"
                      >
                        ✏️
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              <span className="room-code-chip rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold">
                {room.roomId}
              </span>
              <span className="rounded-full border border-black/8 bg-brand-gray px-2 py-0.5 text-[11px] text-muted">
                {room.participantCount}/{room.maxParticipants}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-black/8 bg-brand-gray px-2 py-0.5 text-[11px] text-muted">
                {room.phase !== 'done' && <span className="badge-live-dot" aria-hidden />}
                {PHASE_ICONS[room.phase]} {PHASE_LABELS[room.phase]}
              </span>
            </div>

            <div className="sidebar-actions">
              <button
                type="button"
                onClick={() => void copyInvite()}
                className="btn-secondary rounded-xl px-3 py-2 text-sm"
              >
                {copiedInvite ? '✓ Copied!' : 'Copy invite link'}
              </button>
              <button type="button" onClick={() => void onLeave()} className="btn-secondary rounded-xl px-3 py-2 text-sm">
                Leave room
              </button>
            </div>
          </div>

          <div className="sidebar-section">
            {(room.isCreator && !room.isFacilitator) || (room.isCreator && room.participants.length > 1) ? (
              <FacilitatorToolbar
                variant="sidebar"
                includeSessionControls={false}
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
            ) : null}
          </div>

          {room.isFacilitator && (
            <div className="sidebar-section">
              <p className="text-subtle mb-2 text-[10px] font-semibold uppercase tracking-[0.18em]">
                Comment settings
              </p>
              <button
                type="button"
                onClick={() => onSetCommentAuthorsVisible(!room.showCommentAuthors)}
                className={`comment-names-toggle ${room.showCommentAuthors ? 'comment-names-toggle-on' : ''}`}
                aria-pressed={room.showCommentAuthors}
              >
                <span className="comment-names-toggle-label">Show names on cards & comments</span>
                <span className="comment-names-toggle-state">
                  {room.showCommentAuthors ? 'Visible' : 'Hidden'}
                </span>
              </button>
              <p className="text-muted mt-2 text-[11px] leading-relaxed">
                {room.showCommentAuthors
                  ? 'Everyone can see who wrote each card and comment.'
                  : 'Card and comment names are hidden for all participants.'}
              </p>
            </div>
          )}

          <div className="sidebar-section">
            <ParticipantBar
              variant="sidebar"
              participants={room.participants}
            facilitatorId={room.facilitatorId}
            youId={room.you.id}
            />
          </div>

          {phaseHint && (
            <div className="sidebar-section flex items-start gap-2">
              <span className="text-base leading-none">💡</span>
              <p className="text-muted text-xs leading-relaxed">{phaseHint}</p>
            </div>
          )}
        </aside>

        <main className="board-main flex min-h-0 flex-1 flex-col">
          <div className="board-phase-bar mb-4 shrink-0">
            <div className="panel-accent rounded-2xl px-4 py-3 sm:px-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-subtle mb-2 text-[10px] font-semibold uppercase tracking-[0.18em]">
                    Session phase
                    {!room.canManagePhase && (
                      <span className="ml-2 normal-case tracking-normal text-muted">
                        · {PHASE_LABELS[room.phase]}
                      </span>
                    )}
                  </p>
                  <PhaseStepper room={room} onSetPhase={onSetPhase} />
                </div>
                <SessionTopActions
                  room={room}
                  onStartTimer={onStartTimer}
                  onStopTimer={onStopTimer}
                  onExport={() => setShowExport(true)}
                  onCloseRoom={onCloseRoom}
                  onGroupSelected={handleGroupSelected}
                  selectedCount={selectedCardIds.size}
                />
              </div>
            </div>
          </div>

          <div className="board-columns min-h-0 flex-1">
            <div className="board-columns-grid h-full min-h-0 gap-4">
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

            {canAddColumn &&
              (showAddColumn ? (
                <form
                  onSubmit={handleAddColumn}
                  className="add-column-zone compose-box flex h-full min-h-[420px] flex-col p-4 lg:min-h-0"
                >
                  <p className="text-subtle mb-3 text-xs font-semibold uppercase tracking-[0.12em]">
                    New column
                  </p>
                  <label htmlFor="new-column-label" className="text-subtle mb-1.5 block text-xs font-medium">
                    Column name
                  </label>
                  <input
                    id="new-column-label"
                    value={newColumnLabel}
                    onChange={(e) => setNewColumnLabel(e.target.value)}
                    placeholder="e.g. Shout-outs"
                    className="input-field mb-4 w-full rounded-xl px-3 py-2.5 text-sm"
                    autoFocus
                  />
                  <div className="mt-auto flex flex-col gap-2">
                    <button
                      type="submit"
                      disabled={!newColumnLabel.trim()}
                      className="btn-primary rounded-xl px-5 py-2.5 text-sm"
                    >
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
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddColumn(true)}
                  className="add-column-zone add-column-btn flex h-full min-h-[420px] flex-col items-center justify-center rounded-2xl px-4 py-4 text-sm font-medium lg:min-h-0"
                >
                  + Add another column
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>

      {showExport && <ExportSummaryModal room={room} onClose={() => setShowExport(false)} />}
      {confirmDialog && (
        <ConfirmModal
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          onConfirm={() => {
            confirmDialog.onConfirm()
            setConfirmDialog(null)
          }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
      <ActivityToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
