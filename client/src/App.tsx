import { Analytics } from '@vercel/analytics/react'
import { JoinRoomPage } from './components/JoinRoomPage'
import { Lobby } from './components/Lobby'
import { RetroBoard } from './components/RetroBoard'
import { useRetroRoom } from './hooks/useRetroRoom'

export default function App() {
  const {
    connected,
    error,
    room,
    inviteRoomId,
    restoringSession,
    createRoom,
    joinRoom,
    addCard,
    updateCard,
    deleteCard,
    voteCard,
    unvoteCard,
    groupCards,
    ungroupCard,
    addColumn,
    removeColumn,
    renameColumn,
    updateTitle,
    toggleReaction,
    addComment,
    toggleCommentLike,
    toggleCommentReaction,
    deleteComment,
    setPhase,
    startTimer,
    stopTimer,
    assignFacilitator,
    closeRoom,
    leaveRoom,
    clearError,
  } = useRetroRoom()

  if (room) {
    return (
      <>
        <RetroBoard
          room={room}
          onAddCard={addCard}
          onUpdateCard={updateCard}
          onDeleteCard={deleteCard}
          onVoteCard={voteCard}
          onUnvoteCard={unvoteCard}
          onGroupCards={groupCards}
          onUngroupCard={ungroupCard}
          onAddColumn={addColumn}
          onRemoveColumn={removeColumn}
          onRenameColumn={renameColumn}
          onUpdateTitle={updateTitle}
          onToggleReaction={toggleReaction}
          onAddComment={addComment}
          onToggleCommentLike={toggleCommentLike}
          onToggleCommentReaction={toggleCommentReaction}
          onDeleteComment={deleteComment}
          onSetPhase={setPhase}
          onStartTimer={startTimer}
          onStopTimer={stopTimer}
          onAssignFacilitator={assignFacilitator}
          onCloseRoom={closeRoom}
          onLeave={leaveRoom}
        />
        <Analytics />
      </>
    )
  }

  if (restoringSession) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4">
        <p className="text-muted text-sm">Reconnecting to your room…</p>
      </div>
    )
  }

  if (inviteRoomId) {
    return (
      <>
        <JoinRoomPage
          roomId={inviteRoomId}
          connected={connected}
          error={error}
          onJoinRoom={joinRoom}
          onClearError={clearError}
        />
        <Analytics />
      </>
    )
  }

  return (
    <>
      <Lobby
        connected={connected}
        error={error}
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        onClearError={clearError}
      />
      <Analytics />
    </>
  )
}
