import type { Participant } from '../types'
import { UserAvatar } from './UserAvatar'

interface ParticipantBarProps {
  participants: Participant[]
  facilitatorId: string | null
  youId: string
}

export function ParticipantBar({ participants, facilitatorId, youId }: ParticipantBarProps) {
  const sorted = [...participants].sort((a, b) => {
    if (a.id === youId) return -1
    if (b.id === youId) return 1
    if (a.id === facilitatorId) return -1
    if (b.id === facilitatorId) return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="participant-rail rounded-2xl px-4 py-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-subtle text-[10px] font-semibold uppercase tracking-[0.16em]">
          In this room · {participants.length}
        </p>
        <div className="participant-avatar-stack">
          {sorted.slice(0, 8).map((participant) => (
            <div
              key={participant.id}
              className="relative rounded-full"
              title={participant.name}
            >
              <UserAvatar avatar={participant.avatar} size="sm" />
              {participant.id === facilitatorId && (
                <span className="absolute -right-0.5 -top-0.5 text-[10px] leading-none">👑</span>
              )}
            </div>
          ))}
          {participants.length > 8 && (
            <span className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-[10px] font-bold text-zinc-300 ring-2 ring-[#0f0f12]">
              +{participants.length - 8}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {sorted.map((participant) => {
          const isYou = participant.id === youId
          const isFacilitator = participant.id === facilitatorId

          return (
            <div
              key={participant.id}
              className={`participant-chip flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs ${
                isYou ? 'participant-chip-you' : ''
              }`}
            >
              <UserAvatar avatar={participant.avatar} size="sm" />
              <span className="font-semibold text-on-dark">{participant.name}</span>
              {isYou && <span className="text-brand-yellow-light">· you</span>}
              {isFacilitator && (
                <span className="badge-live rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                  Host
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
