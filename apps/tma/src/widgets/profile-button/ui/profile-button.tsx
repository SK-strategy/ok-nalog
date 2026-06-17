'use client'

import { useRouter } from 'next/navigation'

import { useSession } from '~/entities/session'
import { UserAvatar } from '~/shared/ui/user-avatar'

/**
 * Avatar button in the home/cabinet header → /profile. The profile page is
 * where account + identity settings (email/Telegram linking) live, off the
 * main screens. Renders nothing until the session resolves.
 */
export function ProfileButton() {
  const router = useRouter()
  const { me } = useSession()
  if (!me) return null
  return (
    <button
      type="button"
      aria-label="Профиль"
      onClick={() => router.push('/profile')}
      className="rounded-full transition-opacity active:opacity-70"
    >
      <UserAvatar src={me.user.image} name={me.user.name} className="size-7 text-xs" />
    </button>
  )
}
