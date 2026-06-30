import type { ServerResponse } from 'node:http'
import { isPersistentStorageEnabled } from './roomPersistence.js'
import { getRoom, serializeRoom } from './rooms.js'

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
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  const subscriber: Subscriber = {
    roomId: roomId.toUpperCase(),
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

export function emitRoomClosed(roomId: string): void {
  const normalizedRoomId = roomId.toUpperCase()
  const payload = JSON.stringify({ message: 'The room was closed by the facilitator.' })

  for (const subscriber of subscribers) {
    if (subscriber.roomId !== normalizedRoomId) continue
    subscriber.res.write(`event: room:closed\ndata: ${payload}\n\n`)
    removeSubscriber(subscriber)
    subscriber.res.end?.()
  }
}
