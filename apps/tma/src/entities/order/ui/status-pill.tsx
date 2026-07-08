import type { OrderStatus } from '@tax-assistant/validators'

import { cn } from '~/shared/lib'

import { ORDER_STATUS_LABEL } from '../lib/labels'

type Tone = 'search' | 'pay' | 'work' | 'done' | 'fail'

const TONE: Record<OrderStatus, Tone> = {
  submitted: 'search',
  priced: 'pay',
  awaiting_payment: 'pay',
  payment_expired: 'fail',
  paid: 'work',
  assigned: 'work',
  in_progress: 'work',
  under_review: 'work',
  answered: 'done',
  completed: 'done',
  rated: 'done',
  rejected: 'fail',
  cancelled: 'fail',
}

const TONE_CLASS: Record<Tone, string> = {
  search: 'text-status-search bg-status-search-bg',
  pay: 'text-status-pay bg-status-pay-bg',
  work: 'text-status-work bg-status-work-bg',
  done: 'text-status-done bg-status-done-bg',
  fail: 'text-status-fail bg-status-fail-bg',
}

export function StatusPill({
  status,
  label,
  className,
}: {
  status: OrderStatus
  label?: string
  className?: string
}) {
  const tone = TONE[status]
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold',
        TONE_CLASS[tone],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label ?? ORDER_STATUS_LABEL[status]}
    </span>
  )
}
