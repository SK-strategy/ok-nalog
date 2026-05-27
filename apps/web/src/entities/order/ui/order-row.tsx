'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { formatKopecks } from '@tax-assistant/validators'

import type { Doc } from '~/shared/api'
import { categoryStyle, cn } from '~/shared/lib'

import { formatRelativeDate } from '../lib/format-date'
import { StatusPill } from './status-pill'

type Order = Omit<Doc<'orders'>, 'customerId' | 'assignedExecutorId'>
type Category = Doc<'categories'>

/**
 * One row in the orders list. Renders as a full-tap-target anchor so the
 * whole row is keyboard-navigable; `isFirst` controls the divider so the
 * list reads as a single bordered group.
 */
export function OrderRow({
  order,
  category,
  isFirst,
  href,
}: {
  order: Order
  category?: Category
  isFirst: boolean
  href: string
}) {
  const palette = category ? categoryStyle(category.sortOrder) : null
  const Icon = palette?.icon
  const price = order.approvedPrice ?? order.quotedPrice
  return (
    <Link
      href={href}
      className={cn(
        'relative flex w-full items-center gap-3 px-4 py-3.5 text-left',
        'hover:bg-secondary/40 transition-colors',
        !isFirst &&
          `before:bg-separator before:absolute before:top-0 before:right-0 before:left-[64px]
          before:h-px before:content-[""]`,
      )}
    >
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-[10px]"
        style={palette ? { background: palette.bg, color: palette.fg } : undefined}
      >
        {Icon ? <Icon className="size-5" strokeWidth={1.8} /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="text-foreground min-w-0 flex-1 truncate text-[15px] font-semibold">
            {category?.title ?? 'Обращение'}
          </div>
          <span className="text-hint shrink-0 text-[12px] tabular-nums">
            {formatRelativeDate(order.createdAt)}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <StatusPill status={order.status} />
          {price > 0 && (
            <span className="text-text-soft text-[12px] font-semibold tabular-nums">
              {formatKopecks(price)}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="text-hint size-[18px] shrink-0 opacity-55" />
    </Link>
  )
}

/** Bordered list container that wraps a group of OrderRows. */
export function OrdersList({ children }: { children: React.ReactNode }) {
  return <div className="bg-card overflow-hidden rounded-2xl border">{children}</div>
}
