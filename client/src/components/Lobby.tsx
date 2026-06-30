import { useEffect, useState, type FormEvent } from 'react'
import { loadUserProfile, saveName } from '../lib/userProfile'
import type { RoomPublicInfo } from '../types'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

interface LobbyProps {
  connected: boolean
  error: string | null
  onCreateRoom: (
    name: string,
    passwordProtected: boolean,
    password?: string,
    roomId?: string,
    title?: string,
  ) => Promise<boolean>
  onJoinRoom: (roomId: string, name: string, password?: string) => Promise<boolean>
  onClearError: () => void
}

export function Lobby({ connected, error, onCreateRoom, onJoinRoom, onClearError }: LobbyProps) {
  const [name, setName] = useState(() => loadUserProfile()?.name ?? '')
  const [password, setPassword] = useState('')
  const [passwordProtected, setPasswordProtected] = useState(false)
  const [roomId, setRoomId] = useState('')
  const [customRoomId, setCustomRoomId] = useState('')
  const [retroTitle, setRetroTitle] = useState('')
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [loading, setLoading] = useState(false)
  const [joinInfo, setJoinInfo] = useState<RoomPublicInfo | null>(null)
  const [joinInfoLoading, setJoinInfoLoading] = useState(false)

  useEffect(() => {
    if (mode !== 'join' || roomId.trim().length < 4) {
      setJoinInfo(null)
      return
    }

    let cancelled = false
    setJoinInfoLoading(true)

    async function fetchInfo() {
      try {
        const response = await fetch(
          `${API_BASE}/api/rooms/${encodeURIComponent(roomId.trim())}/info`,
        )
        const payload = (await response.json()) as
          | { ok: true; data: RoomPublicInfo }
          | { ok: false }
        if (!cancelled) {
          setJoinInfo(response.ok && payload.ok ? payload.data : null)
        }
      } catch {
        if (!cancelled) setJoinInfo(null)
      } finally {
        if (!cancelled) setJoinInfoLoading(false)
      }
    }

    const timer = setTimeout(() => void fetchInfo(), 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [mode, roomId])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onClearError()
    setLoading(true)

    saveName(name)

    const ok =
      mode === 'create'
        ? await onCreateRoom(
            name,
            passwordProtected,
            passwordProtected ? password : undefined,
            customRoomId || undefined,
            retroTitle || undefined,
          )
        : await onJoinRoom(roomId, name, joinInfo?.passwordProtected ? password : undefined)

    setLoading(false)
    if (!ok) return
  }

  const joinBlocked = mode === 'join' && joinInfo?.isFull

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      <div className="panel-accent rounded-3xl p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-yellow/40 bg-brand-yellow/10 text-3xl">
            🔄
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-brand-black">Sprint Retrospective</h1>
          <p className="text-muted mt-2">
            Reflect, vote, and capture action items with your team in real time.
          </p>
          <p className="text-subtle mt-1 text-xs">Up to 20 people per room</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-black/8 bg-brand-gray p-1">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              mode === 'create'
                ? 'bg-brand-yellow-light text-brand-black shadow-sm'
                : 'text-muted hover:text-brand-black'
            }`}
          >
            Create room
          </button>
          <button
            type="button"
            onClick={() => setMode('join')}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              mode === 'join'
                ? 'bg-brand-yellow-light text-brand-black shadow-sm'
                : 'text-muted hover:text-brand-black'
            }`}
          >
            Join room
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-muted mb-1.5 block text-sm font-medium">Your name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Alex"
              required
              className="input-field w-full rounded-xl px-4 py-3"
            />
          </label>

          {mode === 'join' ? (
            <label className="block">
              <span className="text-muted mb-1.5 block text-sm font-medium">Room code</span>
              <input
                value={roomId}
                onChange={(event) => setRoomId(event.target.value.toUpperCase())}
                placeholder="A1B2C3"
                required
                maxLength={8}
                className="input-field w-full rounded-xl px-4 py-3 font-mono uppercase tracking-widest"
              />
              {joinInfoLoading && roomId.trim().length >= 4 && (
                <span className="text-subtle mt-1 block text-xs">Checking room…</span>
              )}
              {joinInfo && !joinInfoLoading && (
                <span className="text-subtle mt-1 block text-xs">
                  {joinInfo.title.trim() ? `${joinInfo.title} · ` : ''}
                  {joinInfo.participantCount}/{joinInfo.maxParticipants} in room
                  {joinInfo.isFull ? ' · Room is full' : ''}
                  {joinInfo.passwordProtected ? ' · Password required' : ''}
                </span>
              )}
            </label>
          ) : (
            <>
              <label className="block">
                <span className="text-muted mb-1.5 block text-sm font-medium">
                  Retro title <span className="text-subtle">(optional)</span>
                </span>
                <input
                  value={retroTitle}
                  onChange={(event) => setRetroTitle(event.target.value)}
                  placeholder="e.g. Sprint 42 retrospective"
                  maxLength={80}
                  className="input-field w-full rounded-xl px-4 py-3"
                />
              </label>
              <label className="block">
                <span className="text-muted mb-1.5 block text-sm font-medium">
                  Custom room code <span className="text-subtle">(optional)</span>
                </span>
                <input
                  value={customRoomId}
                  onChange={(event) => setCustomRoomId(event.target.value.toUpperCase())}
                  placeholder="Leave blank to auto-generate"
                  maxLength={8}
                  className="input-field w-full rounded-xl px-4 py-3 font-mono uppercase tracking-widest"
                />
              </label>
            </>
          )}

          {mode === 'create' && (
            <>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-black/8 bg-brand-gray/50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={passwordProtected}
                  onChange={(event) => {
                    setPasswordProtected(event.target.checked)
                    if (!event.target.checked) setPassword('')
                  }}
                  className="h-4 w-4 rounded border-black/20 accent-amber-500"
                />
                <span className="text-sm text-brand-black">Password protect this room</span>
              </label>

              {passwordProtected && (
                <label className="block">
                  <span className="text-muted mb-1.5 block text-sm font-medium">Room password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Set a password for your team"
                    required
                    minLength={4}
                    className="input-field w-full rounded-xl px-4 py-3"
                  />
                </label>
              )}
            </>
          )}

          {mode === 'join' && joinInfo?.passwordProtected && (
            <label className="block">
              <span className="text-muted mb-1.5 block text-sm font-medium">Room password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter room password"
                required
                minLength={4}
                className="input-field w-full rounded-xl px-4 py-3"
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
            disabled={loading || !connected || joinBlocked}
            className="btn-primary w-full rounded-xl px-4 py-3 transition disabled:cursor-not-allowed"
          >
            {loading ? 'Connecting…' : mode === 'create' ? 'Create & enter room' : 'Join room'}
          </button>
        </form>

        <p className="text-subtle mt-4 text-center text-xs">
          {connected ? 'Connected to server' : 'Connecting to server…'}
        </p>
      </div>
    </div>
  )
}
