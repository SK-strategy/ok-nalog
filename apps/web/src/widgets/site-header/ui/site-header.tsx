'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'

import type { HomeMode } from '~/features/switch-mode'
import { SignOutButton, TelegramLoginButton } from '~/features/auth'
import { ModeSwitcher } from '~/features/switch-mode'
import { useSession } from '~/entities/session'
import { cn } from '~/shared/lib'

/**
 * Site-wide header. Sticky at the top of every page. Shows app brand on the
 * left, navigation + mode switcher + user actions on the right. On mobile
 * (<sm) the nav collapses behind a hamburger menu.
 *
 * Auth state drives what's visible:
 *  - signed out: marketing nav + "Войти через Telegram"
 *  - signed in: links to /orders, /executor; mode switcher when both modes apply
 */
export function SiteHeader() {
  const { me } = useSession()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  // The mode switcher only shows when the user has both surfaces available.
  // Customer is the universal default; executor unlocks on approval.
  const isExecutor = me?.executor?.status === 'approved'
  const allowed: HomeMode[] = ['customer']
  if (isExecutor) allowed.push('executor')

  // What the switcher highlights — based on the current pathname so the
  // header always reflects where the user actually is.
  const currentMode: HomeMode = pathname.startsWith('/executor') ? 'executor' : 'customer'

  return (
    <header className="border-separator bg-background sticky top-0 z-30 border-b">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="text-foreground text-base font-bold tracking-tight">
          Налоговый помощник
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-5 text-sm sm:flex">
          {me ? (
            <>
              <NavLink href="/orders" active={pathname === '/orders' || pathname === '/orders/all'}>
                Мои заявки
              </NavLink>
              <NavLink href="/executor" active={pathname.startsWith('/executor')}>
                Кабинет эксперта
              </NavLink>
              <ModeSwitcher current={currentMode} allowed={allowed} />
              <span className="text-text-soft hidden text-xs md:inline">{me.user.name}</span>
              <SignOutButton />
            </>
          ) : (
            <TelegramLoginButton />
          )}
        </nav>

        {/* Mobile trigger */}
        <button
          type="button"
          aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
          aria-expanded={menuOpen}
          className="text-foreground hover:bg-secondary -mr-2 rounded-full p-2 sm:hidden"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="border-separator border-t sm:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3">
            {me ? (
              <>
                <MobileLink href="/orders" onClose={() => setMenuOpen(false)}>
                  Мои заявки
                </MobileLink>
                <MobileLink href="/executor" onClose={() => setMenuOpen(false)}>
                  Кабинет эксперта
                </MobileLink>
                <div
                  className="border-separator/60 mt-1 flex items-center justify-between gap-2
                    border-t pt-3"
                >
                  <span className="text-text-soft truncate text-sm">{me.user.name}</span>
                  <SignOutButton />
                </div>
              </>
            ) : (
              <div onClick={() => setMenuOpen(false)}>
                <TelegramLoginButton />
              </div>
            )}
          </div>
        </div>
      )}
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
        'text-text-soft hover:text-foreground text-sm font-medium transition-colors',
        active && 'text-foreground',
      )}
    >
      {children}
    </Link>
  )
}

function MobileLink({
  href,
  onClose,
  children,
}: {
  href: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className="text-foreground hover:bg-secondary rounded-lg px-3 py-2 text-sm font-medium"
    >
      {children}
    </Link>
  )
}
