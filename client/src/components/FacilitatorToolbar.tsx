import { useEffect, useState } from 'react'
import { PHASE_ICONS, PHASE_LABELS, type ClientRoomState } from '../types'

interface TimerPanelProps {
  timerEndsAt: number | null
  isFacilitator: boolean
  onStop: () => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function TimerPanel({ timerEndsAt, isFacilitator, onStop }: TimerPanelProps) {
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
      className={`flex items-center gap-3 rounded-full border px-4 py-2 shadow-sm ${
        urgent
          ? 'border-red-400/40 bg-red-950/50'
          : 'border-brand-yellow/35 bg-black/30'
      }`}
    >
      <span className="text-lg">{urgent ? '⏰' : '⏱️'}</span>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-subtle">Timer</p>
        <span className={`font-mono text-lg font-bold ${urgent ? 'text-red-400' : 'text-on-dark'}`}>
          {formatTime(remaining)}
        </span>
      </div>
      {isFacilitator && (
        <button type="button" onClick={onStop} className="btn-secondary rounded-full px-2.5 py-1 text-xs">
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
}

const PHASES: ClientRoomState['phase'][] = ['collect', 'vote', 'discuss', 'done']

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
}: FacilitatorToolbarProps) {
  const [timerMinutes, setTimerMinutes] = useState(5)
  const activeIndex = PHASES.indexOf(room.phase)

  return (
    <div className="panel-accent sticky top-3 z-10 mb-5 rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-subtle mb-2 text-[10px] font-semibold uppercase tracking-[0.18em]">
            Session phase
            {!room.canManagePhase && (
              <span className="ml-2 normal-case tracking-normal text-zinc-400">
                · {PHASE_LABELS[room.phase]}
              </span>
            )}
          </p>
          <div
            className="phase-stepper"
            style={{ transform: `translateX(0)` }}
          >
            <div
              className="phase-stepper-indicator"
              style={{ transform: `translateX(calc(${activeIndex} * 100%))` }}
            />
            {PHASES.map((phase, index) => {
              const isActive = room.phase === phase
              const isDone = index < activeIndex
              return (
                <button
                  key={phase}
                  type="button"
                  disabled={!room.canManagePhase}
                  onClick={() => onSetPhase(phase)}
                  className={`phase-step ${
                    isActive
                      ? 'phase-step-active'
                      : isDone
                        ? 'phase-step-done'
                        : 'phase-step-idle'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <span className="mr-1">{isDone && !isActive ? '✓' : PHASE_ICONS[phase]}</span>
                  <span className="hidden sm:inline">{PHASE_LABELS[phase]}</span>
                  <span className="sm:hidden">{PHASE_LABELS[phase].slice(0, 3)}</span>
                </button>
              )
            })}
          </div>
        </div>

        <TimerPanel
          timerEndsAt={room.timerEndsAt}
          isFacilitator={room.isFacilitator}
          onStop={onStopTimer}
        />

        <div className="flex flex-wrap items-center gap-2">
          {room.canManageTimer && !room.timerEndsAt && (
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2 py-1">
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
                className="btn-secondary rounded-full px-2.5 py-1 text-xs"
              >
                Start
              </button>
            </div>
          )}

          {room.canGroup && selectedCount >= 2 && (
            <button
              type="button"
              onClick={onGroupSelected}
              className="btn-primary rounded-full px-4 py-1.5 text-xs shadow-[0_0_20px_rgba(234,179,8,0.4)]"
            >
              Group {selectedCount} cards
            </button>
          )}

          <button type="button" onClick={onExport} className="btn-secondary rounded-full px-3 py-1.5 text-xs">
            Export
          </button>

          {room.isFacilitator && (
            <button
              type="button"
              onClick={() => void onCloseRoom()}
              className="rounded-full border border-red-400/30 bg-red-950/40 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-950/60"
            >
              Close room
            </button>
          )}
        </div>
      </div>

      {room.isCreator && !room.isFacilitator && (
        <p className="text-subtle mt-3 text-xs">You are the room creator but not the facilitator.</p>
      )}

      {room.isCreator && room.participants.length > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/8 pt-4">
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
