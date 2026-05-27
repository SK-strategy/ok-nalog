'use client'

import { usePathname } from 'next/navigation'
import { useQuery } from 'convex/react'

import { cn } from '@tax-assistant/ui'

import { SidebarLink } from '~/widgets/admin-shell/ui/sidebar-link'
import { api } from '~/shared/api'

import { isNavActive, NAV_ITEMS } from '../lib/nav'

/** Compact horizontal nav for narrow viewports (md and below). */
export function MobileBar({ className }: { className?: string }) {
  const pathname = usePathname()
  const pendingExecutors = useQuery(api.executors.pendingCount, {})

  return (
    <nav
      className={cn(
        'bg-sidebar border-sidebar-border flex gap-1 overflow-x-auto border-b px-2 py-2 md:hidden',
        className,
      )}
    >
      {NAV_ITEMS.map((item) => (
        <div key={item.href} className="shrink-0">
          <SidebarLink
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={isNavActive(item.href, pathname)}
            badge={item.badgeKey === 'executorsPending' ? (pendingExecutors ?? 0) : undefined}
          />
        </div>
      ))}
    </nav>
  )
}
