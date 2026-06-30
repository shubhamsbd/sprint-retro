const ROOM_PATH = /^\/room\/([A-Za-z0-9]+)\/?$/

export function parseInviteRoomId(pathname = window.location.pathname): string | null {
  const match = pathname.match(ROOM_PATH)
  return match ? match[1].toUpperCase() : null
}

export function getRoomInviteUrl(roomId: string): string {
  return `${window.location.origin}/room/${roomId}`
}

export function setInvitePath(roomId: string): void {
  window.history.replaceState({}, '', `/room/${roomId}`)
}

export function clearInvitePath(): void {
  if (parseInviteRoomId()) {
    window.history.replaceState({}, '', '/')
  }
}
