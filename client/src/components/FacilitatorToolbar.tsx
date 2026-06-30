import { useEffect, useState } from 'react'
import { PHASE_LABELS, type ClientRoomState } from '../types'
import { PhaseStepper } from './PhaseStepper'

interface TimerPanelProps {
  timerEndsAt: number | null
  isFacilitator: boolean
  onStop: () => void
  compact?: boolean
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function TimerPanel({ timerEndsAt, isFacilitator, onStop, compact = false }: TimerPanelProps) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!timerEndsAt) {
      setRemaining(null)
      return
    }

    function tick() {
      const left = Math.max(0, Math.ceil((timerEndsAt! - Date.now()) / 1000))
      setRemaining(left)
    }

    tick()
    const interval = setInterval(tick, 250)
    return () => clearInterval(interval)
  }, [timerEndsAt])

  if (remaining === null) return null

  const urgent = remaining <= 60

  return (
    <div
      className={`timer-panel flex items-center gap-3 border px-3 py-2 shadow-sm ${
        compact ? 'w-full rounded-xl' : 'rounded-full'
      } ${urgent ? 'timer-panel-urgent' : ''}`}
    >
      <span className="text-lg">{urgent ? '⏰' : '⏱️'}</span>
      <div className="flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-subtle">Timer</p>
        <span className={`font-mono text-lg font-bold ${urgent ? 'text-red-700' : 'text-brand-black'}`}>
          {formatTime(remaining)}
        </span>
      </div>
      {isFacilitator && (
        <button type="button" onClick={onStop} className="btn-secondary rounded-lg px-2.5 py-1 text-xs">
          Stop
        </button>
      )}
    </div>
  )
}

interface FacilitatorToolbarProps {
  room: ClientRoomState
  onSetPhase: (phase: ClientRoomState['phase']) => void
  onStartTimer: (durationSec: number) => void
  onStopTimer: () => void
  onExport: () => void
  onCloseRoom: () => void
  onAssignFacilitator: (facilitatorId: string) => void
  onGroupSelected: () => void
  selectedCount: number
  variant?: 'bar' | 'sidebar'
  includeSessionControls?: boolean
}

export function SessionTopActions({
  room,
  onStartTimer,
  onStopTimer,
  onExport,
  onCloseRoom,
  onGroupSelected,
  selectedCount,
}: Pick<
  FacilitatorToolbarProps,
  | 'room'
  | 'onStartTimer'
  | 'onStopTimer'
  | 'onExport'
  | 'onCloseRoom'
  | 'onGroupSelected'
  | 'selectedCount'
>) {
  const [timerMinutes, setTimerMinutes] = useState(5)

  return (
    <div className="session-top-actions">
      <TimerPanel
        timerEndsAt={room.timerEndsAt}
        isFacilitator={room.isFacilitator}
        onStop={onStopTimer}
      />

      {room.canManageTimer && !room.timerEndsAt && (
        <div className="timer-start-control">
          <label className="timer-start-label">
            <span className="timer-start-heading">Timer</span>
            <span className="timer-start-input-wrap">
              <input
                type="number"
                min={1}
                max={60}
                value={timerMinutes}
                onChange={(e) => setTimerMinutes(Number(e.target.value))}
                className="timer-duration-input"
                aria-label="Timer minutes"
              />
              <span className="timer-start-unit">min</span>
            </span>
          </label>
          <button
            type="button"
            onClick={() => onStartTimer(timerMinutes * 60)}
            className="btn-primary session-action-btn session-action-btn-primary"
          >
            Start timer
          </button>
        </div>
      )}

      {room.canGroup && selectedCount >= 2 && (
        <button
          type="button"
          onClick={onGroupSelected}
          className="btn-primary session-action-btn session-action-btn-primary"
        >
          Group {selectedCount} cards
        </button>
      )}

      <button type="button" onClick={onExport} className="btn-secondary session-action-btn">
        Export
      </button>

      {room.isFacilitator && (
        <button
          type="button"
          onClick={() => void onCloseRoom()}
          className="session-action-btn session-action-btn-danger"
        >
          Close room
        </button>
      )}
    </div>
  )
}

export function FacilitatorToolbar({
  room,
  onSetPhase,
  onStartTimer,
  onStopTimer,
  onExport,
  onCloseRoom,
  onAssignFacilitator,
  onGroupSelected,
  selectedCount,
  variant = 'bar',
  includeSessionControls = true,
}: FacilitatorToolbarProps) {
  const [timerMinutes, setTimerMinutes] = useState(5)
  const isSidebar = variant === 'sidebar'

  const sessionControls = (
    <>
      <TimerPanel
        timerEndsAt={room.timerEndsAt}
        isFacilitator={room.isFacilitator}
        onStop={onStopTimer}
        compact={isSidebar}
      />

      {room.canManageTimer && !room.timerEndsAt && (
        <div className={`toolbar-chip flex items-center gap-1.5 px-2 py-1.5 ${isSidebar ? 'w-full rounded-xl' : 'rounded-full'}`}>
          <input
            type="number"
            min={1}
            max={60}
            value={timerMinutes}
            onChange={(e) => setTimerMinutes(Number(e.target.value))}
            className="input-field w-12 rounded-lg border-0 bg-transparent px-1 py-0.5 text-center text-xs shadow-none focus:shadow-none"
          />
          <span className="text-subtle text-xs">min</span>
          <button
            type="button"
            onClick={() => onStartTimer(timerMinutes * 60)}
            className={`btn-secondary text-xs ${isSidebar ? 'ml-auto rounded-lg px-3 py-1.5' : 'rounded-full px-2.5 py-1'}`}
          >
            Start timer
          </button>
        </div>
      )}

      {room.canGroup && selectedCount >= 2 && (
        <button
          type="button"
          onClick={onGroupSelected}
          className={`btn-primary text-xs ${isSidebar ? 'rounded-xl px-4 py-2.5' : 'rounded-full px-4 py-1.5'}`}
        >
          Group {selectedCount} cards
        </button>
      )}

      <button
        type="button"
        onClick={onExport}
        className={`btn-secondary text-xs ${isSidebar ? 'rounded-xl px-4 py-2.5' : 'rounded-full px-3 py-1.5'}`}
      >
        Export
      </button>

      {room.isFacilitator && (
        <button
          type="button"
          onClick={() => void onCloseRoom()}
          className={`border border-red-200 bg-red-50 text-xs font-medium text-red-700 transition hover:bg-red-100 ${
            isSidebar ? 'w-full rounded-xl px-4 py-2.5' : 'rounded-full px-3 py-1.5'
          }`}
        >
          Close room
        </button>
      )}
    </>
  )

  if (isSidebar) {
    return (
      <div>
        {room.isCreator && !room.isFacilitator && (
          <p className="text-subtle mb-3 text-xs">You are the room creator but not the facilitator.</p>
        )}

        {room.isCreator && room.participants.length > 1 && (
          <div>
            <p className="text-subtle mb-2 text-[10px] font-semibold uppercase tracking-[0.18em]">
              Assign facilitator
            </p>
            <div className="flex flex-col gap-1.5">
              {room.participants
                .filter((p) => p.id !== room.facilitatorId)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onAssignFacilitator(p.id)}
                    className="btn-secondary rounded-lg px-3 py-2 text-left text-xs"
                  >
                    {p.name}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="panel-accent sticky top-3 z-10 mb-5 rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-subtle mb-2 text-[10px] font-semibold uppercase tracking-[0.18em]">
            Session phase
            {!room.canManagePhase && (
              <span className="ml-2 normal-case tracking-normal text-muted">· {PHASE_LABELS[room.phase]}</span>
            )}
          </p>
          <PhaseStepper room={room} onSetPhase={onSetPhase} />
        </div>

        {includeSessionControls && (
          <div className="flex flex-wrap items-center gap-2">{sessionControls}</div>
        )}
      </div>

      {room.isCreator && !room.isFacilitator && (
        <p className="text-subtle mt-3 text-xs">You are the room creator but not the facilitator.</p>
      )}

      {room.isCreator && room.participants.length > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/6 pt-4">
          <span className="text-subtle text-xs font-medium">Assign facilitator:</span>
          {room.participants
            .filter((p) => p.id !== room.facilitatorId)
            .map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onAssignFacilitator(p.id)}
                className="btn-secondary rounded-full px-3 py-1 text-xs"
              >
                {p.name}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
