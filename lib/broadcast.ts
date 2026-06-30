import type { ServerResponse } from 'node:http'
import { isPersistentStorageEnabled } from './roomPersistence.js'
import { getRoom, leaveRoom, serializeRoom } from './rooms.js'

export type SseResponse = Pick<ServerResponse, 'setHeader' | 'write' | 'on' | 'end'>

interface Subscriber {
  roomId: string
  participantId: string
  res: SseResponse
  heartbeat: ReturnType<typeof setInterval>
  poll?: ReturnType<typeof setInterval>
  lastRevision: number
}

const subscribers = new Set<Subscriber>()
const pendingDisconnectLeaves = new Map<string, ReturnType<typeof setTimeout>>()

/** Grace period before removing a participant who disconnected (allows page reload). */
const DISCONNECT_GRACE_MS = 20_000

function pendingLeaveKey(roomId: string, participantId: string): string {
  return `${roomId.toUpperCase()}:${participantId}`
}

function hasActiveSubscriber(roomId: string, participantId: string): boolean {
  const normalizedRoomId = roomId.toUpperCase()
  for (const subscriber of subscribers) {
    if (subscriber.roomId === normalizedRoomId && subscriber.participantId === participantId) {
      return true
    }
  }
  return false
}

function cancelScheduledLeave(roomId: string, participantId: string): void {
  const key = pendingLeaveKey(roomId, participantId)
  const timer = pendingDisconnectLeaves.get(key)
  if (!timer) return
  clearTimeout(timer)
  pendingDisconnectLeaves.delete(key)
}

async function notifyAfterParticipantLeave(roomId: string): Promise<void> {
  const room = await getRoom(roomId)
  if (room) {
    emitRoomState(roomId)
    return
  }
  emitRoomClosed(roomId, 'The room ended because everyone left.')
}

async function removeParticipantAfterDisconnect(
  roomId: string,
  participantId: string,
): Promise<void> {
  if (hasActiveSubscriber(roomId, participantId)) return

  await leaveRoom(participantId, roomId)
  await notifyAfterParticipantLeave(roomId)
}

function scheduleParticipantLeaveOnDisconnect(roomId: string, participantId: string): void {
  const key = pendingLeaveKey(roomId, participantId)
  cancelScheduledLeave(roomId, participantId)

  pendingDisconnectLeaves.set(
    key,
    setTimeout(() => {
      pendingDisconnectLeaves.delete(key)
      void removeParticipantAfterDisconnect(roomId, participantId)
    }, DISCONNECT_GRACE_MS),
  )
}

async function sendState(subscriber: Subscriber): Promise<void> {
  const room = await getRoom(subscriber.roomId)
  if (!room) return

  if (!room.participants.has(subscriber.participantId)) return

  try {
    subscriber.lastRevision = room.revision
    const state = serializeRoom(room, subscriber.participantId)
    subscriber.res.write(`event: room:state\ndata: ${JSON.stringify(state)}\n\n`)
  } catch {
    // Participant no longer in room.
  }
}

function removeSubscriber(subscriber: Subscriber): void {
  clearInterval(subscriber.heartbeat)
  if (subscriber.poll) clearInterval(subscriber.poll)
  subscribers.delete(subscriber)
}

export function subscribe(roomId: string, participantId: string, res: SseResponse): void {
  const normalizedRoomId = roomId.toUpperCase()

  cancelScheduledLeave(normalizedRoomId, participantId)

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  const subscriber: Subscriber = {
    roomId: normalizedRoomId,
    participantId,
    res,
    heartbeat: setInterval(() => {
      res.write(': heartbeat\n\n')
    }, 15000),
    lastRevision: -1,
  }

  subscribers.add(subscriber)
  void sendState(subscriber)

  if (isPersistentStorageEnabled()) {
    subscriber.poll = setInterval(() => {
      void (async () => {
        const room = await getRoom(subscriber.roomId)
        if (!room || !room.participants.has(subscriber.participantId)) return
        if (room.revision !== subscriber.lastRevision) {
          await sendState(subscriber)
        }
      })()
    }, 800)
  }

  res.on('close', () => {
    removeSubscriber(subscriber)
    scheduleParticipantLeaveOnDisconnect(normalizedRoomId, participantId)
  })
}

export function emitRoomState(roomId: string): void {
  const normalizedRoomId = roomId.toUpperCase()
  for (const subscriber of subscribers) {
    if (subscriber.roomId === normalizedRoomId) {
      void sendState(subscriber)
    }
  }
}

export function emitRoomClosed(
  roomId: string,
  message = 'The room was closed by the facilitator.',
): void {
  const normalizedRoomId = roomId.toUpperCase()
  const payload = JSON.stringify({ message })

  for (const subscriber of subscribers) {
    if (subscriber.roomId !== normalizedRoomId) continue
    subscriber.res.write(`event: room:closed\ndata: ${payload}\n\n`)
    removeSubscriber(subscriber)
    subscriber.res.end?.()
  }
}

export async function notifyAfterLeave(roomId: string, participantId: string): Promise<void> {
  cancelScheduledLeave(roomId, participantId)
  await notifyAfterParticipantLeave(roomId)
}
