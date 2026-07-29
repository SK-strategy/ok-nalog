'use client'

import { Clock } from 'lucide-react'

import type { OrderStatus } from '@tax-assistant/validators'
import { cn } from '@tax-assistant/ui'

import { formatDuration } from '../lib/format'

/** The subset of an order the waiting clock needs. */
export interface WaitingSource {
  status: OrderStatus
  createdAt: number
  paidAt?: number
  reviewedAt?: number
  assignedAt?: number
  paymentDeadlineAt?: number
}

/**
 * How long an order has been sitting in its current state, and who it's
 * blocked on.
 *
 * "Создана" alone doesn't answer the question the admin actually has — a
 * заявка created a week ago but assigned yesterday isn't late, while one
 * created an hour ago and still unassigned might be. So the clock restarts at
 * the transition that made the order *wait*, and states nobody is blocked on
 * (in flight with an expert, closed) don't get a counter at all.
 */
export function waitingSince(order: WaitingSource): { since: number; blame: string } | null {
  switch (order.status) {
    case 'submitted':
      // Client is waiting on us to price it.
      return { since: order.createdAt, blame: 'без оценки' }
    case 'paid':
      // The case the customer explicitly asked for: paid, still unassigned.
      return { since: order.paidAt ?? order.createdAt, blame: 'без назначения' }
    case 'under_review':
      // Expert has delivered; the moderator is the holdup.
      return { since: order.reviewedAt ?? order.createdAt, blame: 'на проверке' }
    case 'awaiting_payment':
      // Blocked on the client, not on us — still worth showing, but it's not
      // an SLA breach on our side, so it stays neutral (see `escalation`).
      return { since: order.createdAt, blame: 'ждёт оплаты' }
    case 'payment_expired':
      return { since: order.paymentDeadlineAt ?? order.createdAt, blame: 'оплата просрочена' }
    default:
      // assigned / in_progress: an expert has it. completed / rated / rejected
      // / cancelled: nothing left to wait for.
      return null
  }
}

// Thresholds for "this has been sitting too long". Deliberately coarse — the
// point is to draw the eye to the worst rows, not to encode a real SLA.
const WARN_MS = 4 * 60 * 60 * 1000 // 4 hours
const LATE_MS = 24 * 60 * 60 * 1000 // 1 day

function escalation(elapsed: number, onUs: boolean): string {
  if (!onUs) return 'text-muted-foreground'
  if (elapsed >= LATE_MS) return 'text-destructive font-semibold'
  if (elapsed >= WARN_MS) return 'text-status-pay font-medium'
  return 'text-foreground'
}

/**
 * Live "ждёт 3 ч 40 мин" cell. `now` is passed in rather than read here so a
 * whole table shares one ticking clock (see `useNow`) instead of every row
 * mounting its own interval.
 */
export function WaitingCell({ order, now }: { order: WaitingSource; now: number }) {
  const waiting = waitingSince(order)
  if (!waiting) return <span className="text-muted-foreground text-sm">—</span>

  const elapsed = Math.max(0, now - waiting.since)
  // `awaiting_payment` is the client's move; everything else is on us.
  const onUs = order.status !== 'awaiting_payment'

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm', escalation(elapsed, onUs))}>
      <Clock className="size-3.5 shrink-0 opacity-70" />
      <span className="tabular-nums">{formatDuration(elapsed)}</span>
      <span className="text-muted-foreground text-xs font-normal">· {waiting.blame}</span>
    </span>
  )
}
