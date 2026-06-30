import type { Avatar } from '../lib/avatars'

interface UserAvatarProps {
  avatar: Avatar
  size?: 'sm' | 'md'
  className?: string
}

export function UserAvatar({ avatar, size = 'sm', className = '' }: UserAvatarProps) {
  const sizeClass = size === 'sm' ? 'h-7 w-7 text-sm' : 'h-9 w-9 text-base'
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${sizeClass} ${className}`}
      style={{ backgroundColor: avatar.color }}
      title={avatar.emoji}
    >
      {avatar.emoji}
    </span>
  )
}
