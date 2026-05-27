'use client'

import { ChevronRight, Paperclip } from 'lucide-react'

import { formatKopecks } from '@tax-assistant/validators'

import { categoryStyle } from '~/entities/category'
import { formatRelativeDate } from '~/entities/order'
import type { Doc } from '~/shared/api'
import { cn } from '~/shared/lib'

type Order = Omit<Doc<'orders'>, 'customerId' | 'assignedExecutorId'>
type Category = Doc<'categories'>

interface AvailableOrderRowProps {
  order: Order
  category?: Category
  isFirst: boolean
  /** Tap opens the detail sheet. The row stays tappable even while the
   *  executor has an active заявка — preview is non-destructive; the sheet
   *  is where the disabled-claim affordance lives. */
  onSelect: () => void
}

/**
 * One row in the executor's "Доступные заявки" pool. Renders a compact
 * preview — category + 2-line description + price + age — and routes the
 * whole tap target to the detail sheet, where the full description and
 * claim button live. No inline claim button: two affordances per row
 * (open-detail vs. claim-now) creates ambiguity, and we want the executor
 * to read before they grab.
 */
export function AvailableOrderRow({ order, category, isFirst, onSelect }: AvailableOrderRowProps) {
  const palette = category ? categoryStyle(category.sortOrder) : null
  const Icon = palette?.icon
  const price = order.approvedPrice ?? order.quotedPrice
  const attachmentCount = order.attachmentIds.length

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative flex w-full items-start gap-3 px-4 py-3.5 text-left transition-opacity',
        'active:opacity-80',
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
            {category?.title ?? 'Заявка'}
          </div>
          <span className="text-hint shrink-0 text-[12px] tabular-nums">
            {formatRelativeDate(order.createdAt)}
          </span>
        </div>
        <p className="text-text-soft mt-1 line-clamp-2 text-[13px] leading-snug break-words">
          {order.description}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-foreground text-[14px] font-bold tabular-nums">
            {formatKopecks(price)}
          </span>
          {attachmentCount > 0 && (
            <span className="text-hint inline-flex items-center gap-0.5 text-[12px]">
              <Paperclip className="size-3.5" strokeWidth={1.8} />
              {attachmentCount}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="text-hint mt-1 size-4 shrink-0" />
    </button>
  )
}
