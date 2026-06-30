import { PHASE_ICONS, PHASE_LABELS, type ClientRoomState } from '../types'

const PHASES: ClientRoomState['phase'][] = ['collect', 'vote', 'discuss', 'done']

interface PhaseStepperProps {
  room: ClientRoomState
  onSetPhase: (phase: ClientRoomState['phase']) => void
  layout?: 'horizontal' | 'vertical'
}

export function PhaseStepper({ room, onSetPhase, layout = 'horizontal' }: PhaseStepperProps) {
  const activeIndex = PHASES.indexOf(room.phase)
  const isVertical = layout === 'vertical'

  return (
    <div className={isVertical ? 'phase-stepper-vertical' : 'phase-stepper w-full'}>
      <div
        className="phase-stepper-indicator"
        style={{
          transform: isVertical
            ? `translateY(calc(${activeIndex} * 100%))`
            : `translateX(calc(${activeIndex} * 100%))`,
        }}
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
            className={`phase-step flex items-center justify-center ${
              isActive ? 'phase-step-active' : isDone ? 'phase-step-done' : 'phase-step-idle'
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <span className="mr-1.5">{isDone && !isActive ? '✓' : PHASE_ICONS[phase]}</span>
            {PHASE_LABELS[phase]}
          </button>
        )
      })}
    </div>
  )
}
