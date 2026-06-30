import { existsSync } from 'node:fs'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Participant, RetroColumnDef, StickyCard } from './types.js'

const ROOM_KEY_PREFIX = 'room:'
const FILE_DATA_DIR = path.join(process.cwd(), '.retro-data')
const ROOM_TTL_SECONDS = 60 * 60 * 24

export interface PersistedRoom {
  id: string
  title?: string
  phase: 'collect' | 'vote' | 'discuss' | 'done'
  creatorId: string
  facilitatorId: string | null
  timerEndsAt: number | null
  timerDurationSec: number | null
  showCommentAuthors?: boolean
  passwordSalt: string | null
  passwordHash: string | null
  participants: Participant[]
  cards: StickyCard[]
  columns?: RetroColumnDef[]
  revision: number
}

const memoryRooms = new Map<string, PersistedRoom>()

type StorageBackend = 'memory' | 'upstash' | 'redis-url'

import { Redis } from '@upstash/redis'
import { createClient } from 'redis'

let upstashClient: Redis | null | undefined

function getStorageBackend(): StorageBackend {
  const restUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  if (restUrl && restToken) return 'upstash'
  if (process.env.REDIS_URL) return 'redis-url'
  return 'memory'
}

function getUpstashClient(): Redis | null {
  if (upstashClient !== undefined) return upstashClient

  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  if (!url || !token) {
    upstashClient = null
    return null
  }

  upstashClient = new Redis({ url, token })
  return upstashClient
}

async function withRedisUrlClient<T>(
  fn: (client: ReturnType<typeof createClient>) => Promise<T>,
): Promise<T | null> {
  const url = process.env.REDIS_URL
  if (!url) return null

  const client = createClient({ url })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.quit()
  }
}

export function isPersistentStorageEnabled(): boolean {
  return getStorageBackend() !== 'memory'
}

function roomKey(roomId: string): string {
  return `${ROOM_KEY_PREFIX}${roomId.toUpperCase()}`
}

function parseStoredRoom(value: unknown): PersistedRoom | null {
  if (!value || typeof value !== 'object') return null
  return value as PersistedRoom
}

function filePathForRoom(roomId: string): string {
  return path.join(FILE_DATA_DIR, `${roomId.toUpperCase()}.json`)
}

async function ensureFileDataDir(): Promise<void> {
  if (!existsSync(FILE_DATA_DIR)) {
    await mkdir(FILE_DATA_DIR, { recursive: true })
  }
}

async function loadPersistedRoomFromFile(roomId: string): Promise<PersistedRoom | null> {
  try {
    const raw = await readFile(filePathForRoom(roomId), 'utf8')
    return parseStoredRoom(JSON.parse(raw))
  } catch {
    return null
  }
}

async function savePersistedRoomToFile(room: PersistedRoom): Promise<void> {
  await ensureFileDataDir()
  await writeFile(filePathForRoom(room.id), JSON.stringify(room))
}

async function deletePersistedRoomFromFile(roomId: string): Promise<void> {
  try {
    await unlink(filePathForRoom(roomId))
  } catch {
    // ignore missing file
  }
}

export async function loadPersistedRoom(roomId: string): Promise<PersistedRoom | null> {
  const normalizedId = roomId.toUpperCase()
  const key = roomKey(normalizedId)
  const backend = getStorageBackend()

  if (backend === 'upstash') {
    const redis = getUpstashClient()
    if (!redis) return null
    const stored = await redis.get<PersistedRoom>(key)
    return stored ?? null
  }

  if (backend === 'redis-url') {
    const stored = await withRedisUrlClient(async (client) => {
      const raw = await client.get(key)
      if (!raw) return null
      return parseStoredRoom(JSON.parse(raw))
    })
    return stored ?? null
  }

  const inMemory = memoryRooms.get(normalizedId)
  if (inMemory) return inMemory

  const fromFile = await loadPersistedRoomFromFile(normalizedId)
  if (fromFile) {
    memoryRooms.set(normalizedId, fromFile)
    return fromFile
  }

  return null
}

export async function savePersistedRoom(room: PersistedRoom): Promise<void> {
  const normalizedId = room.id.toUpperCase()
  const payload: PersistedRoom = { ...room, id: normalizedId, revision: room.revision + 1 }
  const key = roomKey(normalizedId)
  const backend = getStorageBackend()

  if (backend === 'upstash') {
    const redis = getUpstashClient()
    if (!redis) return
    await redis.set(key, payload, { ex: ROOM_TTL_SECONDS })
    return
  }

  if (backend === 'redis-url') {
    await withRedisUrlClient(async (client) => {
      await client.set(key, JSON.stringify(payload), { EX: ROOM_TTL_SECONDS })
    })
    return
  }

  memoryRooms.set(normalizedId, payload)
  await savePersistedRoomToFile(payload)
}

export async function deletePersistedRoom(roomId: string): Promise<void> {
  const normalizedId = roomId.toUpperCase()
  const key = roomKey(normalizedId)
  const backend = getStorageBackend()

  if (backend === 'upstash') {
    const redis = getUpstashClient()
    if (!redis) return
    await redis.del(key)
    return
  }

  if (backend === 'redis-url') {
    await withRedisUrlClient(async (client) => {
      await client.del(key)
    })
    return
  }

  memoryRooms.delete(normalizedId)
  await deletePersistedRoomFromFile(normalizedId)
}

export async function persistedRoomExists(roomId: string): Promise<boolean> {
  const room = await loadPersistedRoom(roomId)
  return room !== null
}
