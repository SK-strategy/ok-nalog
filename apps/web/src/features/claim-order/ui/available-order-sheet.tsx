'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { Paperclip } from 'lucide-react'

import { Button } from '@tax-assistant/ui/button'
import { formatKopecks } from '@tax-assistant/validators'

import { formatRelativeDate } from '~/entities/order'
import type { Id } from '~/shared/api'
import { api } from '~/shared/api'
import { categoryStyle } from '~/shared/lib'
import { Modal } from '~/shared/ui/modal'

interface AvailableOrderSheetProps {
  orderId: Id<'orders'> | null
  hasActive: boolean
  onClose: () => void
}

/**
 * Detail sheet for a single заявка from the executor's available pool.
 * Subscribes to `orders.availablePreview` so the moment another executor
 * claims this заявка the result flips to `null` and the sheet swaps to an
 * "уже взяли" state — no stale claim button.
 */
export function AvailableOrderSheet({ orderId, hasActive, onClose }: AvailableOrderSheetProps) {
  if (orderId === null) return null
  return <SheetInner orderId={orderId} hasActive={hasActive} onClose={onClose} />
}

function SheetInner({
  orderId,
  hasActive,
  onClose,
}: {
  orderId: Id<'orders'>
  hasActive: boolean
  onClose: () => void
}) {
  const preview = useQuery(api.orders.availablePreview, { orderId })
  const claim = useMutation(api.orders.claim)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onClaim() {
    setBusy(true)
    setError(null)
    try {
      await claim({ orderId })
      onClose()
    } catch (e) {
      if (e instanceof ConvexError) {
        const data = e.data as { message?: string } | undefined
        setError(data?.message ?? 'Не удалось взять заявку')
      } else {
        setError('Не удалось взять заявку')
      }
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Заявка">
      {preview === undefined ? (
        <Loading />
      ) : preview === null ? (
        <Unavailable onClose={onClose} />
      ) : (
        <Body
          order={preview.order}
          category={preview.category}
          tag={preview.tag}
          hasActive={hasActive}
          busy={busy}
          error={error}
          onClaim={() => void onClaim()}
        />
      )}
    </Modal>
  )
}

function Body({
  order,
  category,
  tag,
  hasActive,
  busy,
  error,
  onClaim,
}: {
  order: {
    _id: Id<'orders'>
    description: string
    attachmentIds: Id<'_storage'>[]
    quotedPrice: number
    approvedPrice?: number
    createdAt: number
  }
  category: { title: string; sortOrder: number } | null
  tag: { name: string } | null
  hasActive: boolean
  busy: boolean
  error: string | null
  onClaim: () => void
}) {
  const palette = category ? categoryStyle(category.sortOrder) : null
  const Icon = palette?.icon
  const price = order.approvedPrice ?? order.quotedPrice
  const attachmentCount = order.attachmentIds.length

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-4">
        <div className="flex items-start gap-3">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-[12px]"
            style={palette ? { background: palette.bg, color: palette.fg } : undefined}
          >
            {Icon ? <Icon className="size-6" strokeWidth={1.8} /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-foreground text-[16px] leading-tight font-bold">
              {category?.title ?? 'Заявка'}
            </div>
            <div className="text-hint mt-1 text-[12px] tabular-nums">
              {formatRelativeDate(order.createdAt)}
            </div>
          </div>
        </div>

        {tag && (
          <div className="mt-3">
            <span
              className="bg-primary-soft text-primary inline-flex items-center rounded-full px-2.5
                py-1 text-[12px] font-semibold"
            >
              {tag.name}
            </span>
          </div>
        )}

        <div className="mt-4">
          <div className="text-hint text-[11px] font-bold tracking-[0.06em] uppercase">
            Стоимость
          </div>
          <div className="text-foreground mt-0.5 text-[24px] leading-none font-bold tabular-nums">
            {formatKopecks(price)}
          </div>
        </div>

        <div className="mt-5">
          <div className="text-hint text-[11px] font-bold tracking-[0.06em] uppercase">
            Описание
          </div>
          <p
            className="text-foreground mt-1.5 text-[14px] leading-relaxed break-words
              whitespace-pre-wrap"
          >
            {order.description}
          </p>
        </div>

        {attachmentCount > 0 && (
          <div className="bg-card mt-5 flex items-center gap-3 rounded-2xl border px-4 py-3">
            <div
              className="bg-primary-soft text-primary flex size-9 shrink-0 items-center
                justify-center rounded-[10px]"
            >
              <Paperclip className="size-[18px]" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-foreground text-[14px] font-semibold">
                {attachmentCount} {pluralRu(attachmentCount, 'файл', 'файла', 'файлов')}
              </p>
              <p className="text-text-soft mt-0.5 text-[12px] leading-snug">
                Доступны после того, как вы возьмёте заявку в работу.
              </p>
            </div>
          </div>
        )}

        <p className="text-hint mt-5 text-[12px] leading-relaxed">
          Имя и контакты клиента не видны. Общение — только внутри заявки.
        </p>
      </div>

      <div className="border-separator bg-background shrink-0 border-t px-5 pt-3 pb-5">
        {error && <p className="text-destructive mb-2 text-[13px]">{error}</p>}
        {hasActive && !error && (
          <p className="text-status-pay mb-2 text-[13px]">
            Сначала завершите текущую заявку, чтобы взять новую.
          </p>
        )}
        <Button className="w-full" disabled={busy || hasActive} onClick={onClaim}>
          {busy ? 'Берём…' : 'Взять заявку'}
        </Button>
      </div>
    </div>
  )
}

function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-3 px-5 pt-1 pb-5">
      <div className="bg-secondary h-14 animate-pulse rounded-2xl" />
      <div className="bg-secondary h-24 animate-pulse rounded-2xl" />
    </div>
  )
}

function Unavailable({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2 px-6 pt-4 pb-6 text-center">
      <p className="text-foreground text-[15px] font-bold">Заявку уже взяли</p>
      <p className="text-text-soft text-[13px] leading-snug">
        Другой эксперт оказался быстрее. Выберите другую заявку из списка.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="bg-primary text-primary-foreground mt-3 rounded-xl px-4 py-2 text-[14px]
          font-semibold"
      >
        Закрыть
      </button>
    </div>
  )
}

function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return many
  if (last === 1) return one
  if (last >= 2 && last <= 4) return few
  return many
}
