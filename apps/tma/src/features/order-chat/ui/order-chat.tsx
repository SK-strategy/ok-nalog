'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { ExternalLink, Paperclip, Send } from 'lucide-react'

import { isChatOpen } from '@tax-assistant/validators'

import { formatChatTimestamp } from '~/entities/order'
import { useSession } from '~/entities/session'
import type { Doc, Id } from '~/shared/api'
import { api } from '~/shared/api'
import { cn } from '~/shared/lib'

type Order = Omit<Doc<'orders'>, 'customerId' | 'assignedExecutorId'>
interface ChatMessage {
  _id: Id<'messages'>
  senderRole: 'customer' | 'executor' | 'system'
  body: string
  attachmentIds: Id<'_storage'>[]
  createdAt: number
  mine: boolean
}
type Role = 'customer' | 'executor' | 'admin'

/**
 * The order timeline + composer. Rendered as a chat-style ticket:
 *  - Customer's original description shows as the first bubble.
 *  - System messages appear inline as small centered pills with timestamps.
 *  - Customer/executor messages are bubbles (mine right-aligned, theirs
 *    left). Identities stay anonymized — only role labels are shown.
 *  - `action` is an inline slot rendered just before the composer so the
 *    view can drop status-driven action cards (Оплатить, Принять ответ, …)
 *    into the timeline without coupling them to the chat feature.
 *  - Composer is shown only when `isChatOpen(order.status)`; outside that
 *    window, the chat is read-only and the action slot (or absence of it)
 *    is the only thing left for the user to interact with.
 */
export function OrderChat({
  order,
  role,
  action,
}: {
  order: Order
  role: Role
  action?: React.ReactNode
}) {
  const { isAuthenticated } = useSession()
  const messages = useQuery(
    api.messages.list,
    isAuthenticated ? { orderId: order._id } : 'skip',
  ) as ChatMessage[] | undefined
  const send = useMutation(api.messages.send)

  // Collect every attachment id we'll need to render and resolve URLs in
  // one query. Deduped + sorted so the cache key stays stable even when
  // new messages arrive in different orders.
  const allAttachmentIds = useMemo(() => {
    const set = new Set<Id<'_storage'>>(order.attachmentIds)
    if (messages) for (const m of messages) for (const id of m.attachmentIds) set.add(id)
    return [...set].sort()
  }, [order.attachmentIds, messages])

  const attachmentRows = useQuery(
    api.files.getUrls,
    isAuthenticated && allAttachmentIds.length > 0 ? { ids: allAttachmentIds } : 'skip',
  )
  const urlById = useMemo(() => {
    const m = new Map<Id<'_storage'>, string | null>()
    if (attachmentRows) for (const r of attachmentRows) m.set(r.id, r.url)
    return m
  }, [attachmentRows])

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  // Auto-scroll to the bottom when new messages arrive.
  const scrollRef = useRef<HTMLDivElement>(null)
  const messageCount = messages?.length ?? 0
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messageCount])

  const composerEnabled = isChatOpen(order.status) && role !== 'admin'

  async function submit() {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    try {
      await send({ orderId: order._id, body, attachmentIds: [] })
      setDraft('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        <ChatBubble
          body={order.description}
          attachmentIds={order.attachmentIds}
          urlById={urlById}
          createdAt={order.createdAt}
          mine={role === 'customer'}
        />

        {messages === undefined && (
          <div className="text-hint mt-4 text-center text-xs">Загрузка диалога…</div>
        )}

        {messages?.map((m) =>
          m.senderRole === 'system' ? (
            <SystemEvent key={m._id} body={m.body} createdAt={m.createdAt} />
          ) : (
            <ChatBubble
              key={m._id}
              body={m.body}
              attachmentIds={m.attachmentIds}
              urlById={urlById}
              createdAt={m.createdAt}
              mine={m.mine}
            />
          ),
        )}

        {action && <div className="mt-4">{action}</div>}
      </div>

      {composerEnabled && (
        <Composer
          draft={draft}
          onChange={setDraft}
          onSubmit={() => void submit()}
          sending={sending}
        />
      )}
    </div>
  )
}

// ─── chat bubble ─────────────────────────────────────────────────────────
function ChatBubble({
  body,
  attachmentIds,
  urlById,
  createdAt,
  mine,
}: {
  body: string
  attachmentIds: Id<'_storage'>[]
  urlById: Map<Id<'_storage'>, string | null>
  createdAt: number
  mine: boolean
}) {
  return (
    <div className={cn('mt-2 flex w-full', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug whitespace-pre-wrap',
          mine
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-secondary text-foreground rounded-bl-md',
        )}
      >
        {body && <div>{body}</div>}
        {attachmentIds.length > 0 && (
          <div className={cn('flex flex-col gap-1', body ? 'mt-2' : '')}>
            {attachmentIds.map((id, i) => (
              <AttachmentPill
                key={id}
                index={i + 1}
                url={urlById.get(id) ?? null}
                resolving={!urlById.has(id)}
                mine={mine}
              />
            ))}
          </div>
        )}
        <div
          className={cn(
            'mt-1 text-right text-[10.5px] tabular-nums',
            mine ? 'text-primary-foreground/70' : 'text-hint',
          )}
        >
          {formatChatTimestamp(createdAt)}
        </div>
      </div>
    </div>
  )
}

function AttachmentPill({
  index,
  url,
  resolving,
  mine,
}: {
  index: number
  url: string | null
  resolving: boolean
  mine: boolean
}) {
  const label = resolving
    ? 'Загрузка…'
    : (url ?? null) === null
      ? 'Файл недоступен'
      : `Файл ${index}`
  const baseClass = cn(
    'inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[12.5px] font-semibold',
    mine ? 'text-primary-foreground bg-white/15' : 'bg-background/70 text-foreground',
    (!url || resolving) && 'opacity-70',
  )
  if (!url) {
    return (
      <span className={baseClass}>
        <Paperclip className="size-3.5" />
        {label}
      </span>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(baseClass, 'transition-opacity active:opacity-80')}
    >
      <Paperclip className="size-3.5" />
      <span className="flex-1">{label}</span>
      <ExternalLink className="size-3 opacity-70" />
    </a>
  )
}

// ─── system event ────────────────────────────────────────────────────────
function SystemEvent({ body, createdAt }: { body: string; createdAt: number }) {
  return (
    <div className="my-3 flex justify-center">
      <div
        className="bg-secondary/70 text-text-soft inline-flex max-w-[85%] items-center gap-2
          rounded-full px-3 py-1 text-[11.5px] font-medium"
      >
        <span className="text-hint tabular-nums">{formatChatTimestamp(createdAt)}</span>
        <span className="bg-hint/40 size-0.5 rounded-full" />
        <span className="truncate">{body}</span>
      </div>
    </div>
  )
}

// ─── composer ────────────────────────────────────────────────────────────
function Composer({
  draft,
  onChange,
  onSubmit,
  sending,
}: {
  draft: string
  onChange: (v: string) => void
  onSubmit: () => void
  sending: boolean
}) {
  const trimmed = draft.trim()
  const canSend = trimmed.length > 0 && !sending
  return (
    <div className="border-separator bg-background border-t px-3 py-2.5">
      <div className="bg-secondary flex items-end gap-2 rounded-2xl py-1.5 pr-1.5 pl-3.5">
        <textarea
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSubmit()
            }
          }}
          placeholder="Сообщение…"
          rows={1}
          className="text-foreground placeholder:text-hint max-h-32 min-h-[28px] flex-1 resize-none
            bg-transparent py-1.5 text-[15px] outline-none"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSend}
          aria-label="Отправить"
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full transition-opacity',
            canSend ? 'bg-primary text-primary-foreground' : 'bg-hint/30 text-hint',
          )}
        >
          <Send className="size-4" />
        </button>
      </div>
    </div>
  )
}
