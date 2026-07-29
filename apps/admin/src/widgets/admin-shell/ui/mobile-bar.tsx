'use client'

import { usePathname } from 'next/navigation'

import { cn } from '@tax-assistant/ui'

import { SidebarLink } from '~/widgets/admin-shell/ui/sidebar-link'

import { isNavActive, NAV_ITEMS } from '../lib/nav'
import { useNavBadges } from '../lib/use-nav-badges'

/** Compact horizontal nav for narrow viewports (md and below). */
export function MobileBar({ className }: { className?: string }) {
  const pathname = usePathname()
  const badgeFor = useNavBadges()

  return (
    <nav
      className={cn(
        'bg-sidebar border-sidebar-border flex gap-1 overflow-x-auto border-b px-2 py-2 md:hidden',
        className,
      )}
    >
      {NAV_ITEMS.map((item) => {
        const badge = badgeFor(item)
        return (
          <div key={item.href} className="shrink-0">
            <SidebarLink
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={isNavActive(item.href, pathname)}
              badge={badge?.count}
              badgeReason={badge?.reason}
            />
          </div>
        )
      })}
    </nav>
  )
}
