'use client'

import type { ComponentType } from 'react'
import Link from 'next/link'

import { cn } from '@tax-assistant/ui'

interface SidebarLinkProps {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  active: boolean
  badge?: number
}

export function SidebarLink({ href, label, icon: Icon, active, badge }: SidebarLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        `text-sidebar-foreground hover:bg-sidebar-accent focus-visible:ring-sidebar-ring relative
        flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors
        focus-visible:ring-2 focus-visible:outline-none`,
        active && 'bg-primary-soft text-primary hover:bg-primary-soft',
      )}
    >
      <Icon
        className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')}
        aria-hidden
      />
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className="bg-destructive text-destructive-foreground inline-flex h-4 min-w-4 items-center
            justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums"
        >
          {badge}
        </span>
      )}
    </Link>
  )
}
