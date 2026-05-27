'use client'

import { ChevronRight } from 'lucide-react'

import { formatKopecks } from '@tax-assistant/validators'

import { categoryStyle } from '~/entities/category'
import type { Doc } from '~/shared/api'
import { cn } from '~/shared/lib'

import { formatRelativeDate } from '../lib/format-date'
import { StatusPill } from './status-pill'

// Accepts both the full doc and the anonymized shape returned to non-admin
// participants (customerId / assignedExecutorId stripped). The row only
// needs the public fields.
type Order = Omit<Doc<'orders'>, 'customerId' | 'assignedExecutorId'>
type Category = Doc<'categories'>

/**
 * Single row in the orders list — used on the home and the all-orders page.
 * Shows the category icon, title, status pill, optional price, and the
 * relative date. `isFirst` controls the divider so the list reads as a
 * single bordered group.
 */
export function OrderRow({
  order,
  category,
  isFirst,
  onClick,
}: {
  order: Order
  category?: Category
  isFirst: boolean
  onClick: () => void
}) {
  const palette = category ? categoryStyle(category.sortOrder) : null
  const Icon = palette?.icon
  const price = order.approvedPrice ?? order.quotedPrice
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex w-full items-center gap-3 px-4 py-3.5 text-left',
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
    </button>
  )
}

/** Bordered list container that wraps a group of OrderRows. */
export function OrdersList({ children }: { children: React.ReactNode }) {
  return <div className="bg-card mx-4 overflow-hidden rounded-2xl">{children}</div>
}
