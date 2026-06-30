import { AVATAR_COLORS, AVATAR_EMOJIS, type Avatar } from './avatars'

export interface UserProfile {
  name: string
  customizedAvatar?: Avatar
}

const STORAGE_KEY = 'sprint-retro-profile'

function isValidAvatar(value: unknown): value is Avatar {
  if (!value || typeof value !== 'object') return false
  const { emoji, color } = value as Avatar
  return (
    typeof emoji === 'string' &&
    AVATAR_EMOJIS.includes(emoji as (typeof AVATAR_EMOJIS)[number]) &&
    typeof color === 'string' &&
    AVATAR_COLORS.includes(color as (typeof AVATAR_COLORS)[number])
  )
}

export function loadUserProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<UserProfile>
    if (typeof parsed.name !== 'string' || !parsed.name.trim()) return null
    const profile: UserProfile = { name: parsed.name.trim() }
    if (parsed.customizedAvatar && isValidAvatar(parsed.customizedAvatar)) {
      profile.customizedAvatar = parsed.customizedAvatar
    }
    return profile
  } catch {
    return null
  }
}

export function saveUserProfile(profile: UserProfile): void {
  try {
    const payload: UserProfile = { name: profile.name.trim() }
    if (profile.customizedAvatar && isValidAvatar(profile.customizedAvatar)) {
      payload.customizedAvatar = profile.customizedAvatar
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }
}

export function avatarForSession(name: string): Avatar | undefined {
  const profile = loadUserProfile()
  if (!profile?.customizedAvatar) return undefined
  if (profile.name.toLowerCase() !== name.trim().toLowerCase()) return undefined
  return profile.customizedAvatar
}

export function saveName(name: string): void {
  const existing = loadUserProfile()
  saveUserProfile({
    name: name.trim(),
    customizedAvatar: existing?.customizedAvatar,
  })
}

export function saveCustomizedAvatar(name: string, avatar: Avatar): void {
  saveUserProfile({ name: name.trim(), customizedAvatar: avatar })
}
