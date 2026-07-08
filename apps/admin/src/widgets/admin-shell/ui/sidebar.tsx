'use client'

import { usePathname } from 'next/navigation'
import { useQuery } from 'convex/react'
import { LogOut } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@tax-assistant/ui/avatar'

import { useSession } from '~/entities/session'
import { api } from '~/shared/api'

import { isNavActive, NAV_ITEMS } from '../lib/nav'
import { SidebarLink } from './sidebar-link'

/**
 * Persistent left rail. Compact (212px) with a refined brand mark, a single
 * primary nav group, and a footer that pairs the signed-in admin with an
 * icon-only sign-out button.
 */
export function Sidebar() {
  const pathname = usePathname()
  const { me, signOut } = useSession()
  const pendingExecutors = useQuery(api.executors.pendingCount, {})
  const pendingChanges = useQuery(api.executors.pendingChangesCount, {})
  const executorsBadge = (pendingExecutors ?? 0) + (pendingChanges ?? 0)

  return (
    <aside
      className="bg-sidebar border-sidebar-border sticky top-0 hidden h-dvh w-[212px] shrink-0
        flex-col border-r md:flex"
    >
      <div className="border-sidebar-border flex h-14 items-center gap-2 border-b px-4">
        <div
          className="bg-sidebar-primary text-sidebar-primary-foreground flex size-7 items-center
            justify-center rounded-md text-xs font-bold shadow-xs"
        >
          НП
        </div>
        <span className="text-sidebar-foreground truncate text-[13px] font-semibold tracking-tight">
          Налоговый помощник
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        <p
          className="text-muted-foreground/70 mb-1 px-2 text-[10px] font-semibold tracking-wider
            uppercase"
        >
          Управление
        </p>
        {NAV_ITEMS.map((item) => (
          <SidebarLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={isNavActive(item.href, pathname)}
            badge={item.badgeKey === 'executorsPending' ? executorsBadge : undefined}
          />
        ))}
      </nav>

      {me && (
        <div className="border-sidebar-border flex items-center gap-2.5 border-t p-3">
          <Avatar className="size-7 shrink-0">
            {me.user.image ? <AvatarImage src={me.user.image} alt={me.user.name} /> : null}
            <AvatarFallback className="text-[10px] font-medium">
              {me.user.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-xs font-medium">{me.user.name}</span>
            {me.user.telegramUsername && (
              <span className="text-muted-foreground truncate text-[11px]">
                @{me.user.telegramUsername}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Выйти"
            className="hover:bg-sidebar-accent text-muted-foreground hover:text-foreground flex
              size-7 shrink-0 items-center justify-center rounded-md transition-colors"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      )}
    </aside>
  )
}
