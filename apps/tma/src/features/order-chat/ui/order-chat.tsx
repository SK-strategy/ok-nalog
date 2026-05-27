'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'

import { Button } from '@tax-assistant/ui/button'

import { useSession } from '~/entities/session'
import type { Id } from '~/shared/api'
import { api } from '~/shared/api'
import { cn } from '~/shared/lib'

const ROLE_LABEL = {
  customer: 'Заказчик',
  executor: 'Исполнитель',
  system: 'Система',
} as const

/** Anonymized order thread — only role labels are ever shown. */
export function OrderChat({ orderId }: { orderId: Id<'orders'> }) {
  const { isAuthenticated } = useSession()
  const messages = useQuery(api.messages.list, isAuthenticated ? { orderId } : 'skip')
  const send = useMutation(api.messages.send)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  async function submit() {
    if (!isAuthenticated || !draft.trim()) return
    setSending(true)
    try {
      await send({ orderId, body: draft.trim(), attachmentIds: [] })
      setDraft('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-lg border p-3">
        {messages?.length === 0 && (
          <p className="text-muted-foreground text-center text-sm">Сообщений пока нет</p>
        )}
        {messages?.map((m) => (
          <div
            key={m._id}
            className={cn(
              'max-w-[80%] rounded-lg px-3 py-2 text-sm',
              m.senderRole === 'system'
                ? 'bg-muted text-muted-foreground mx-auto text-center text-xs'
                : m.mine
                  ? 'bg-primary text-primary-foreground self-end'
                  : 'bg-accent self-start',
            )}
          >
            {m.senderRole !== 'system' && (
              <span className="block text-xs opacity-70">{ROLE_LABEL[m.senderRole]}</span>
            )}
            {m.body}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          placeholder="Сообщение…"
          className="border-input bg-background focus-visible:ring-ring flex-1 rounded-md border
            px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
        <Button disabled={sending || !draft.trim()} onClick={() => void submit()}>
          Отправить
        </Button>
      </div>
    </div>
  )
}
