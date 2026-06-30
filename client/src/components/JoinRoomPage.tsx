import { useEffect, useState, type FormEvent } from 'react'
import { loadUserProfile, saveName } from '../lib/userProfile'
import type { RoomPublicInfo } from '../types'
import { Link } from './Link'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

interface JoinRoomPageProps {
  roomId: string
  connected: boolean
  error: string | null
  onJoinRoom: (roomId: string, name: string, password?: string) => Promise<boolean>
  onClearError: () => void
}

export function JoinRoomPage({
  roomId,
  connected,
  error,
  onJoinRoom,
  onClearError,
}: JoinRoomPageProps) {
  const [name, setName] = useState(() => loadUserProfile()?.name ?? '')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [roomInfo, setRoomInfo] = useState<RoomPublicInfo | null>(null)
  const [roomStatus, setRoomStatus] = useState<'loading' | 'ready' | 'missing'>('loading')

  useEffect(() => {
    let cancelled = false

    async function checkRoom() {
      try {
        const response = await fetch(`${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/info`)
        const payload = (await response.json()) as
          | { ok: true; data: RoomPublicInfo }
          | { ok: false }
        if (cancelled) return
        if (response.ok && payload.ok) {
          setRoomInfo(payload.data)
          setRoomStatus('ready')
        } else {
          setRoomStatus('missing')
        }
      } catch {
        if (!cancelled) setRoomStatus('missing')
      }
    }

    void checkRoom()
    return () => {
      cancelled = true
    }
  }, [roomId])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onClearError()
    setLoading(true)
    saveName(name)
    await onJoinRoom(roomId, name, roomInfo?.passwordProtected ? password : undefined)
    setLoading(false)
  }

  if (roomStatus === 'loading') {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4">
        <p className="text-muted text-sm">Checking room…</p>
      </div>
    )
  }

  if (roomStatus === 'missing') {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
        <div className="panel-accent rounded-3xl p-8 text-center">
          <h1 className="text-2xl font-bold text-on-dark">Room not found</h1>
          <p className="text-muted mt-2">
            Room <span className="font-mono text-brand-yellow-dark">{roomId}</span> does not exist or
            has been closed.
          </p>
          <Link
            href="/"
            className="btn-primary mt-6 inline-block rounded-xl px-5 py-3 text-sm font-semibold"
          >
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  if (roomInfo?.isFull) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
        <div className="panel-accent rounded-3xl p-8 text-center">
          <h1 className="text-2xl font-bold text-on-dark">Room is full</h1>
          <p className="text-muted mt-2">
            Room <span className="font-mono text-brand-yellow-dark">{roomId}</span> already has{' '}
            {roomInfo.maxParticipants} participants.
          </p>
          <Link
            href="/"
            className="btn-primary mt-6 inline-block rounded-xl px-5 py-3 text-sm font-semibold"
          >
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      <div className="panel-accent rounded-3xl p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-yellow/40 bg-brand-yellow/10 text-3xl">
            🔄
          </div>
          <h1 className="text-2xl font-bold text-on-dark">Join retrospective</h1>
          {roomInfo?.title.trim() ? (
            <p className="mt-2 text-lg font-semibold text-on-dark">{roomInfo.title.trim()}</p>
          ) : null}
          <p className="text-muted mt-2">
            You&apos;ve been invited to room{' '}
            <span className="font-mono font-semibold text-brand-yellow-dark">{roomId}</span>
          </p>
          {roomInfo && (
            <p className="text-subtle mt-1 text-xs">
              {roomInfo.participantCount}/{roomInfo.maxParticipants} in room
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-muted mb-1.5 block text-sm font-medium">Your name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Alex"
              required
              autoFocus
              className="input-field-light w-full rounded-xl px-4 py-3"
            />
          </label>

          {roomInfo?.passwordProtected && (
            <label className="block">
              <span className="text-muted mb-1.5 block text-sm font-medium">Room password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter the password from your host"
                required
                minLength={4}
                className="input-field-light w-full rounded-xl px-4 py-3"
              />
            </label>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !connected}
            className="btn-primary w-full rounded-xl px-4 py-3 transition disabled:cursor-not-allowed"
          >
            {loading ? 'Joining…' : 'Join session'}
          </button>
        </form>

        <p className="text-subtle mt-4 text-center text-xs">
          {connected ? 'Connected to server' : 'Connecting to server…'}
        </p>

        <p className="text-muted mt-4 text-center text-sm">
          <Link href="/" className="hover:text-brand-yellow-dark">
            Create your own room instead
          </Link>
        </p>
      </div>
    </div>
  )
}
