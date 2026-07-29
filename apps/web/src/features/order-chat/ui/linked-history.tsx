'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { ChevronDown, History } from 'lucide-react'

import { formatChatTimestamp } from '~/entities/order'
import type { Id } from '~/shared/api'
import { api } from '~/shared/api'
import { cn } from '~/shared/lib'

interface LinkedMessage {
  _id: Id<'messages'>
  senderRole: 'customer' | 'executor' | 'system'
  body: string
  attachmentIds: Id<'_storage'>[]
  createdAt: number
}

interface LinkedOrder {
  _id: Id<'orders'>
  description: string
  attachmentIds: Id<'_storage'>[]
  categoryTitle: string | null
  createdAt: number
  messages: LinkedMessage[]
}

/**
 * Past заявки the customer attached to this one, rendered read-only above the
 * live thread.
 *
 * This is the payoff for the attachment: the эксперт opens a new заявка and
 * can read the earlier case in place, rather than asking the client to retell
 * it. Collapsed by default so a long history never pushes the actual question
 * off-screen, and never interactive — the old thread is closed, so there's
 * nothing to reply to.
 */
export function LinkedHistory({ orderId, hasLinks }: { orderId: Id<'orders'>; hasLinks: boolean }) {
  const linked = useQuery(api.orders.linkedHistory, hasLinks ? { orderId } : 'skip') as
    | LinkedOrder[]
    | undefined

  if (!hasLinks || !linked || linked.length === 0) return null

  return (
    <div className="mb-3 flex flex-col gap-2">
      {linked.map((o) => (
        <LinkedThread key={o._id} order={o} />
      ))}
    </div>
  )
}

function LinkedThread({ order }: { order: LinkedOrder }) {
  const [open, setOpen] = useState(false)
  const replies = order.messages.filter((m) => m.senderRole !== 'system')

  return (
    <div className="border-separator bg-secondary/40 rounded-2xl border border-dashed">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left"
      >
        <History className="text-hint size-3.5 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="text-foreground block truncate text-[13px] font-semibold">
            Прошлое обращение · {order.categoryTitle ?? 'без категории'}
          </span>
          <span className="text-hint block text-[11.5px]">
            {formatChatTimestamp(order.createdAt)} · сообщений: {replies.length}
          </span>
        </span>
        <ChevronDown
          className={cn('text-hint size-4 shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="border-separator flex flex-col gap-2 border-t px-3.5 py-3">
          <HistoryLine role="customer" body={order.description} createdAt={order.createdAt} />
          {replies.map((m) => (
            <HistoryLine
              key={m._id}
              role={m.senderRole}
              body={m.body}
              createdAt={m.createdAt}
              attachments={m.attachmentIds.length}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function HistoryLine({
  role,
  body,
  createdAt,
  attachments = 0,
}: {
  role: 'customer' | 'executor' | 'system'
  body: string
  createdAt: number
  attachments?: number
}) {
  return (
    <div className="text-[13px] leading-snug">
      <span
        className={cn(
          'text-[11px] font-semibold',
          role === 'executor' ? 'text-status-work' : 'text-hint',
        )}
      >
        {role === 'executor' ? 'Эксперт' : 'Заказчик'}
      </span>
      <span className="text-hint ml-1.5 text-[10.5px] tabular-nums">
        {formatChatTimestamp(createdAt)}
      </span>
      {body && <div className="text-text-soft break-words whitespace-pre-wrap">{body}</div>}
      {attachments > 0 && <div className="text-hint text-[11.5px]">📎 вложений: {attachments}</div>}
    </div>
  )
}
