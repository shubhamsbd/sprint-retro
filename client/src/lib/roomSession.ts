const STORAGE_KEY = 'sprint-retro-session'

export interface RoomSession {
  roomId: string
  participantId: string
}

export function loadRoomSession(): RoomSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RoomSession>
    if (
      typeof parsed.roomId !== 'string' ||
      !parsed.roomId.trim() ||
      typeof parsed.participantId !== 'string' ||
      !parsed.participantId.trim()
    ) {
      return null
    }
    return {
      roomId: parsed.roomId.trim().toUpperCase(),
      participantId: parsed.participantId.trim(),
    }
  } catch {
    return null
  }
}

export function saveRoomSession(session: RoomSession): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        roomId: session.roomId.trim().toUpperCase(),
        participantId: session.participantId.trim(),
      }),
    )
  } catch {
    // ignore
  }
}

export function clearRoomSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
