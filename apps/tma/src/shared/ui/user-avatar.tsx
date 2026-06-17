import { cn } from '~/shared/lib'

/**
 * Round user avatar with an initials fallback. Size is driven by `className`
 * (e.g. `size-7` in the header, `size-20` on the profile page). `src` is the
 * Telegram `photo_url` for Telegram-born users, absent for email-born ones.
 */
export function UserAvatar({
  src,
  name,
  className,
}: {
  src?: string | null
  name: string
  className?: string
}) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      className={cn(
        `bg-secondary text-text-soft flex shrink-0 items-center justify-center overflow-hidden
        rounded-full font-semibold`,
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- external Telegram CDN avatar; next/image would need per-host remotePatterns
        <img src={src} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
      ) : (
        initial
      )}
    </span>
  )
}
