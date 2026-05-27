'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'

import { Button } from '@tax-assistant/ui/button'
import { formatKopecks } from '@tax-assistant/validators'

import { categoryStyle } from '~/entities/category'
import { formatRelativeDate } from '~/entities/order'
import type { Doc } from '~/shared/api'
import { api } from '~/shared/api'
import { cn } from '~/shared/lib'

type Order = Omit<Doc<'orders'>, 'customerId' | 'assignedExecutorId'>
type Category = Doc<'categories'>

interface AvailableOrderRowProps {
  order: Order
  category?: Category
  /** Disables the claim button + shows the lock message — set when the
   *  executor already has an active order in flight. */
  hasActive: boolean
  isFirst: boolean
}

/**
 * One row in the executor's "Доступные заявки" pool. Shows enough of the
 * customer's request that the expert can decide whether to take it — title,
 * description preview, price, age — without giving away identity. The
 * claim button surfaces typed server errors (BUSY, BAD_CATEGORY, BAD_STATUS)
 * directly under the row so the executor sees why it was refused.
 */
export function AvailableOrderRow({ order, category, hasActive, isFirst }: AvailableOrderRowProps) {
  const claim = useMutation(api.orders.claim)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const palette = category ? categoryStyle(category.sortOrder) : null
  const Icon = palette?.icon
  const price = order.approvedPrice ?? order.quotedPrice

  async function onClaim() {
    setBusy(true)
    setError(null)
    try {
      await claim({ orderId: order._id })
    } catch (e) {
      if (e instanceof ConvexError) {
        const data = e.data as { message?: string } | undefined
        setError(data?.message ?? 'Не удалось взять заявку')
      } else {
        setError('Не удалось взять заявку')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={cn(
        'relative flex flex-col gap-3 px-4 py-3.5',
        !isFirst &&
          `before:bg-separator before:absolute before:top-0 before:right-0 before:left-[64px]
          before:h-px before:content-[""]`,
      )}
    >
      <div className="flex items-start gap-3">
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
          <p className="text-text-soft mt-1 line-clamp-2 text-[13px] leading-snug">
            {order.description}
          </p>
          <div className="text-foreground mt-1.5 text-[14px] font-bold tabular-nums">
            {formatKopecks(price)}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pl-[52px]">
        <span
          className={cn(
            'text-[12px]',
            hasActive ? 'text-status-pay' : 'text-hint',
            error && 'text-destructive',
          )}
        >
          {error ?? (hasActive ? 'Сначала завершите текущую заявку' : 'Доступна для работы')}
        </span>
        <Button size="sm" disabled={busy || hasActive} onClick={() => void onClaim()}>
          {busy ? 'Берём…' : 'Взять'}
        </Button>
      </div>
    </div>
  )
}
