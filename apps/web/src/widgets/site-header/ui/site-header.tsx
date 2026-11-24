'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Check, ChevronDown } from 'lucide-react'

import type { HomeMode } from '~/features/switch-mode'
import { LoginButton, SignOutButton } from '~/features/auth'
import { MODE_HINT, MODE_LABEL, MODE_ROUTE, useHomeMode } from '~/features/switch-mode'
import { useSession } from '~/entities/session'
import { cn } from '~/shared/lib'
import { UserAvatar } from '~/shared/ui/user-avatar'

import { LandingBurger, LandingNav } from './landing-nav'

/**
 * Site-wide header. Sticky at the top of every page.
 *
 * Navigation pattern differs by viewport:
 *
 *  - **sm+ (desktop / iPad landscape)**: explicit text nav links —
 *    "Мои заявки" + "Кабинет эксперта" (the latter only for approved
 *    executors). Web convention.
 *  - **<sm (mobile)**: a single dropdown button shows the current section
 *    and opens to mode rows + user info + sign-out. The dropdown IS the
 *    mobile menu — no separate hamburger.
 *
 * The "Кабинет эксперта" link only appears for approved executors because
 * the dashboard's "Стать экспертом" CTA is the proper entry point for new
 * applicants. Showing a "cabinet" link to someone without a cabinet is
 * misleading.
 *
 * On the landing (pathname === '/') the header swaps to marketing
 * navigation: section anchors + «Загрузить документ» CTA, burger on mobile.
 * Product routes keep the original behaviour untouched.
 */
export function SiteHeader() {
  const { me } = useSession()
  const pathname = usePathname()

  // Which dashboards the user can reach. Everyone is a customer; only
  // approved executors get the executor surface in the nav.
  const isExecutor = me?.executor?.status === 'approved'
  const allowed: HomeMode[] = ['customer']
  if (isExecutor) allowed.push('executor')

  // What the mobile dropdown highlights / desktop links underline — based
  // on the current URL so the header always reflects where the user is.
  const currentMode: HomeMode = pathname.startsWith('/executor') ? 'executor' : 'customer'

  // Landing gets its own header; every other route keeps the product one.
  const isLanding = pathname === '/'

  return (
    <header className="border-separator bg-background sticky top-0 z-30 border-b">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="text-foreground text-base font-bold tracking-tight">
          Налоговый помощник
        </Link>

        {/* Desktop: explicit links + user + sign-out */}
        <nav className="hidden items-center gap-5 text-sm sm:flex">
          {isLanding ? (
            <LandingNav isAuthed={!!me} />
          ) : me ? (
            <>
              <NavLink
                href="/orders"
                active={pathname === '/orders' || pathname.startsWith('/orders')}
              >
                Мои заявки
              </NavLink>
              {isExecutor && (
                <NavLink href="/executor" active={pathname.startsWith('/executor')}>
                  Кабинет эксперта
                </NavLink>
              )}
              <Link
                href="/profile"
                aria-label="Профиль"
                className="flex items-center gap-2 transition-opacity hover:opacity-80"
              >
                <span className="text-text-soft hidden text-xs md:inline">{me.user.name}</span>
                <UserAvatar src={me.user.image} name={me.user.name} className="size-7 text-xs" />
              </Link>
              <SignOutButton />
            </>
          ) : (
            <LoginButton />
          )}
        </nav>

        {/* Mobile: single combined dropdown */}
        <div className="sm:hidden">
          {isLanding ? (
            <LandingBurger isAuthed={!!me} />
          ) : me ? (
            <MobileMenu current={currentMode} allowed={allowed} userName={me.user.name} />
          ) : (
            <LoginButton />
          )}
        </div>
      </div>
    </header>
  )
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        'relative text-sm font-medium transition-colors',
        // Underline accent on the active link — clearer than just color.
        active
          ? `text-foreground after:bg-primary after:absolute after:-bottom-[18px] after:left-0
            after:h-0.5 after:w-full after:content-[""]`
          : 'text-text-soft hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}

/**
 * Combined mobile menu. The trigger button shows the current section so
 * users know where they are at a glance; tapping it opens a panel with
 * mode rows (acts as nav) + user info + sign-out.
 */
function MobileMenu({
  current,
  allowed,
  userName,
}: {
  current: HomeMode
  allowed: HomeMode[]
  userName: string
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const [, setMode] = useHomeMode()

  // Close on click outside / escape so the dropdown behaves like a menu.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selectMode = (next: HomeMode) => {
    setMode(next)
    setOpen(false)
    router.push(MODE_ROUTE[next])
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="bg-secondary text-foreground hover:bg-secondary/80 flex items-center gap-1
          rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {MODE_LABEL[current]}
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          className="border-separator bg-background absolute top-full right-0 z-50 mt-1.5 w-64
            overflow-hidden rounded-xl border shadow-lg"
          role="menu"
        >
          <div className="flex flex-col py-1">
            {allowed.map((m) => (
              <ModeRow
                key={m}
                label={MODE_LABEL[m]}
                hint={MODE_HINT[m]}
                selected={current === m}
                onClick={() => selectMode(m)}
              />
            ))}
          </div>
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="border-separator/60 hover:bg-secondary flex items-center gap-3 border-t px-3
              py-2.5"
          >
            <span className="text-foreground text-[14px] font-semibold">Профиль</span>
            <span className="text-text-soft truncate text-[12px]">{userName}</span>
          </Link>
          <div className="border-separator/60 flex items-center justify-end border-t px-3 py-2">
            <div onClick={() => setOpen(false)}>
              <SignOutButton />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ModeRow({
  label,
  hint,
  selected,
  onClick,
}: {
  label: string
  hint: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors',
        selected ? 'bg-primary-soft' : 'hover:bg-secondary',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-foreground text-[14px] leading-tight font-semibold">{label}</div>
        <div className="text-text-soft mt-0.5 text-[12px] leading-tight">{hint}</div>
      </div>
      {selected && <Check className="text-primary mt-0.5 size-4 shrink-0" />}
    </button>
  )
}
