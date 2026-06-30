export interface Avatar {
  emoji: string
  color: string
}

export const AVATAR_EMOJIS = [
  '🦊',
  '🐼',
  '🐸',
  '🦁',
  '🐙',
  '🦄',
  '🐨',
  '🐯',
  '🐵',
  '🐧',
  '🦉',
  '🐶',
  '🐱',
  '🐰',
  '🐻',
  '🐲',
  '🤖',
  '👽',
  '🧙',
  '🧑‍💻',
  '👩‍🚀',
  '🧑‍🎨',
  '⚡',
  '🔥',
  '⭐',
  '🎯',
  '🚀',
  '💎',
  '🌊',
  '🧩',
] as const

export const AVATAR_COLORS = [
  '#dbeafe',
  '#bfdbfe',
  '#a5f3fc',
  '#99f6e4',
  '#bbf7d0',
  '#d9f99d',
  '#fde68a',
  '#fecdd3',
  '#fbcfe8',
  '#e9d5ff',
  '#ddd6fe',
  '#e7e5e4',
] as const

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function defaultAvatar(seed: string): Avatar {
  const hash = hashString(seed.trim() || 'guest')
  return {
    emoji: AVATAR_EMOJIS[hash % AVATAR_EMOJIS.length],
    color: AVATAR_COLORS[(hash >> 4) % AVATAR_COLORS.length],
  }
}

export function parseAvatar(input: unknown, fallbackSeed: string): Avatar {
  if (!input || typeof input !== 'object') return defaultAvatar(fallbackSeed)

  const { emoji, color } = input as { emoji?: unknown; color?: unknown }
  const validEmoji =
    typeof emoji === 'string' &&
    AVATAR_EMOJIS.includes(emoji as (typeof AVATAR_EMOJIS)[number])
  const validColor =
    typeof color === 'string' &&
    AVATAR_COLORS.includes(color as (typeof AVATAR_COLORS)[number])

  if (!validEmoji || !validColor) return defaultAvatar(fallbackSeed)

  return { emoji, color }
}
