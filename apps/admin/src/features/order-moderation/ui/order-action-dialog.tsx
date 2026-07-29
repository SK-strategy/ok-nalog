'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { ArrowRight } from 'lucide-react'

import type { OrderStatus } from '@tax-assistant/validators'
import { cn } from '@tax-assistant/ui'
import { Button } from '@tax-assistant/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@tax-assistant/ui/dialog'
import { Input } from '@tax-assistant/ui/input'
import { Label } from '@tax-assistant/ui/label'
import { StarRating } from '@tax-assistant/ui/star-rating'
import { formatKopecks, kopecksToRubles, rublesToKopecks } from '@tax-assistant/validators'

import type { Doc, Id } from '~/shared/api'
import { api } from '~/shared/api'
import { formatDateTime, shortId } from '~/shared/lib'
import { ORDER_STATUS_LABEL, OrderStatusBadge } from '~/shared/ui'

interface OrderActionDialogProps {
  orderId: Id<'orders'> | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Status-aware moderation dialog. Loads the order detail and renders the form
 * that matches the current state — pricing, assignment, payment confirmation,
 * etc. Closes itself once the mutation completes.
 */
export function OrderActionDialog({ orderId, open, onOpenChange }: OrderActionDialogProps) {
  const data = useQuery(api.orders.adminGet, orderId ? { orderId } : 'skip')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {!data && (
          <>
            <DialogHeader>
              <DialogTitle>Загрузка…</DialogTitle>
            </DialogHeader>
            <div className="h-32" />
          </>
        )}
        {data && (
          <OrderActionContent
            order={data.order}
            category={data.category}
            executorNickname={data.executorNickname}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function OrderActionContent({
  order,
  category,
  executorNickname,
  onDone,
}: {
  order: Doc<'orders'>
  category: Doc<'categories'> | null
  /** The assigned executor's customer-facing handle, for the review thread. */
  executorNickname: string | null
  onDone: () => void
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className="font-mono text-sm tracking-tight opacity-70">
            № {shortId(order._id)}
          </span>
          <span className="truncate">{category?.title ?? 'Без категории'}</span>
        </DialogTitle>
        <DialogDescription asChild>
          <div className="flex items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <span className="text-muted-foreground text-xs">
              · создана {formatDateTime(order.createdAt)}
            </span>
          </div>
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3 text-sm">
        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Текст заявки
        </p>
        <p
          className="bg-secondary/40 max-h-40 overflow-y-auto rounded-md border p-3
            whitespace-pre-wrap"
        >
          {order.description}
        </p>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span>
            Ориентировочно:{' '}
            <span className="text-foreground tabular-nums">{formatKopecks(order.quotedPrice)}</span>
          </span>
          {order.approvedPrice !== undefined && (
            <span>
              Утверждено:{' '}
              <span className="text-foreground tabular-nums">
                {formatKopecks(order.approvedPrice)}
              </span>
            </span>
          )}
          {order.paymentDeadlineAt && (
            <span>Оплата до: {formatDateTime(order.paymentDeadlineAt)}</span>
          )}
          {order.rating !== undefined && (
            <span className="inline-flex items-center gap-1.5">
              Оценка клиента: <StarRating value={order.rating} showValue={false} />
            </span>
          )}
        </div>

        {order.answerBody && (
          <>
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Ответ эксперта
            </p>
            <p
              className="bg-secondary/40 max-h-48 overflow-y-auto rounded-md border p-3
                whitespace-pre-wrap"
            >
              {order.answerBody}
            </p>
          </>
        )}
      </div>

      <StatusForm order={order} executorNickname={executorNickname} onDone={onDone} />
      <StatusOverride order={order} />
    </>
  )
}

function StatusForm({
  order,
  executorNickname,
  onDone,
}: {
  order: Doc<'orders'>
  executorNickname: string | null
  onDone: () => void
}) {
  switch (order.status) {
    case 'submitted':
      return <PriceForm order={order} onDone={onDone} />
    case 'under_review':
      return <ReviewAnswerForm order={order} executorNickname={executorNickname} onDone={onDone} />
    case 'awaiting_payment':
      return <MarkPaidForm order={order} onDone={onDone} />
    case 'payment_expired':
      return <ReopenForm order={order} onDone={onDone} />
    case 'paid':
      return <AssignForm order={order} onDone={onDone} />
    default:
      return (
        <DialogFooter>
          <Button variant="outline" onClick={onDone}>
            Закрыть
          </Button>
        </DialogFooter>
      )
  }
}

// ── Per-status forms ────────────────────────────────────────────────────────

function PriceForm({ order, onDone }: { order: Doc<'orders'>; onDone: () => void }) {
  const approve = useMutation(api.orders.approvePrice)
  const reject = useMutation(api.orders.reject)
  const [price, setPrice] = useState(String(kopecksToRubles(order.quotedPrice)))
  const [reason, setReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [busy, setBusy] = useState<false | 'approve' | 'reject'>(false)
  const priceNum = Number(price)

  async function submitApprove() {
    if (!priceNum) return
    setBusy('approve')
    try {
      await approve({ orderId: order._id, approvedPrice: rublesToKopecks(priceNum) })
      onDone()
    } finally {
      setBusy(false)
    }
  }

  async function submitReject() {
    if (reason.trim().length < 3) {
      setShowReject(true)
      return
    }
    setBusy('reject')
    try {
      await reject({ orderId: order._id, reason: reason.trim() })
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="order-price">Утверждённая стоимость, ₽</Label>
        <Input
          id="order-price"
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        {priceNum > 0 && (
          <span className="text-muted-foreground text-xs">
            ≈ {formatKopecks(rublesToKopecks(priceNum))}. Клиент получит счёт на 24 часа.
          </span>
        )}
      </div>

      {showReject && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="order-reject">Причина отказа</Label>
          <Input
            id="order-reject"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Мин. 3 символа"
          />
        </div>
      )}

      <DialogFooter>
        <Button variant="destructive" disabled={busy !== false} onClick={() => void submitReject()}>
          {busy === 'reject' ? 'Отклоняем…' : 'Отклонить'}
        </Button>
        <Button disabled={busy !== false || !priceNum} onClick={() => void submitApprove()}>
          {busy === 'approve' ? 'Утверждаем…' : 'Утвердить стоимость'}
        </Button>
      </DialogFooter>
    </div>
  )
}

function ReviewAnswerForm({
  order,
  executorNickname,
  onDone,
}: {
  order: Doc<'orders'>
  executorNickname: string | null
  onDone: () => void
}) {
  const approveReview = useMutation(api.orders.approveReview)
  const rejectReview = useMutation(api.orders.rejectReview)
  const [note, setNote] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [busy, setBusy] = useState<false | 'approve' | 'reject'>(false)

  async function submitApprove() {
    setBusy('approve')
    try {
      await approveReview({ orderId: order._id })
      onDone()
    } finally {
      setBusy(false)
    }
  }

  async function submitReject() {
    if (!showReject) {
      setShowReject(true)
      return
    }
    setBusy('reject')
    try {
      await rejectReview({ orderId: order._id, note: note.trim() })
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ReviewConversation orderId={order._id} executorNickname={executorNickname} />
      {showReject && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="review-note">Комментарий для эксперта (необязательно)</Label>
          <Input
            id="review-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Что нужно доработать"
          />
        </div>
      )}
      <DialogFooter>
        <Button variant="destructive" disabled={busy !== false} onClick={() => void submitReject()}>
          {busy === 'reject' ? 'Возвращаем…' : 'На доработку'}
        </Button>
        <Button disabled={busy !== false} onClick={() => void submitApprove()}>
          {busy === 'approve' ? 'Закрываем…' : 'Одобрить и закрыть'}
        </Button>
      </DialogFooter>
    </div>
  )
}

/**
 * The full customer↔executor dialog the moderator verifies before closing.
 * The conversation is the deliverable now, so the admin reads the whole
 * thread here rather than a single answer artifact. Identities stay
 * anonymised — the executor is labelled with the same handle the customer
 * sees in their chat header, never the real name. Falls back to the generic
 * «Эксперт» for profiles that predate nicknames.
 */
function ReviewConversation({
  orderId,
  executorNickname,
}: {
  orderId: Id<'orders'>
  executorNickname: string | null
}) {
  const messages = useQuery(api.messages.list, { orderId })
  const executorLabel = executorNickname ?? 'Эксперт'
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
        Переписка
      </p>
      <div
        className="bg-secondary/40 flex max-h-64 flex-col gap-2 overflow-y-auto rounded-md border
          p-3"
      >
        {messages === undefined && <p className="text-muted-foreground text-xs">Загрузка…</p>}
        {messages?.length === 0 && (
          <p className="text-muted-foreground text-xs">Сообщений пока нет</p>
        )}
        {messages?.map((m) =>
          m.senderRole === 'system' ? (
            <p key={m._id} className="text-muted-foreground text-center text-[11px] italic">
              {m.body}
            </p>
          ) : (
            <div key={m._id} className="text-sm">
              <span
                className={cn(
                  'text-[11px] font-semibold',
                  m.senderRole === 'executor' ? 'text-status-work' : 'text-status-search',
                )}
              >
                {m.senderRole === 'executor' ? executorLabel : 'Заказчик'}
              </span>
              {m.body && <span className="ml-2 whitespace-pre-wrap">{m.body}</span>}
              {m.attachmentIds.length > 0 && (
                <span className="text-muted-foreground ml-2 text-xs">
                  📎 {m.attachmentIds.length}
                </span>
              )}
            </div>
          ),
        )}
      </div>
    </div>
  )
}

function MarkPaidForm({ order, onDone }: { order: Doc<'orders'>; onDone: () => void }) {
  const markPaid = useMutation(api.orders.markPaid)
  const [busy, setBusy] = useState(false)
  return (
    <DialogFooter>
      <Button variant="outline" onClick={onDone} disabled={busy}>
        Отмена
      </Button>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await markPaid({ orderId: order._id })
            onDone()
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'Сохраняем…' : 'Подтвердить оплату'}
      </Button>
    </DialogFooter>
  )
}

function ReopenForm({ order, onDone }: { order: Doc<'orders'>; onDone: () => void }) {
  const reopen = useMutation(api.orders.reopenPayment)
  const [busy, setBusy] = useState(false)
  return (
    <DialogFooter>
      <Button variant="outline" onClick={onDone} disabled={busy}>
        Закрыть
      </Button>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await reopen({ orderId: order._id })
            onDone()
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'Открываем…' : 'Открыть оплату повторно'}
      </Button>
    </DialogFooter>
  )
}

function AssignForm({ order, onDone }: { order: Doc<'orders'>; onDone: () => void }) {
  const executors = useQuery(api.executors.listApproved, {})
  const assign = useMutation(api.orders.assignExecutor)
  const [pick, setPick] = useState<Id<'users'> | ''>('')
  const [busy, setBusy] = useState(false)

  // Reset picker if the order id changes under us.
  useEffect(() => {
    setPick('')
  }, [order._id])

  const { fit, rest } = useMemo(() => {
    const fit: Doc<'executorProfiles'>[] = []
    const rest: Doc<'executorProfiles'>[] = []
    for (const ex of executors ?? []) {
      if (ex.categoryIds.includes(order.categoryId)) fit.push(ex)
      else rest.push(ex)
    }
    return { fit, rest }
  }, [executors, order.categoryId])

  async function submit() {
    if (!pick) return
    setBusy(true)
    try {
      await assign({ orderId: order._id, executorUserId: pick })
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="order-executor">Исполнитель</Label>
        <select
          id="order-executor"
          value={pick}
          onChange={(e) => setPick(e.target.value as Id<'users'>)}
          disabled={busy}
          className={cn(
            `border-input bg-background focus-visible:ring-ring/50 h-9 rounded-md border px-3
            text-sm focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed
            disabled:opacity-50`,
          )}
        >
          <option value="">— выберите —</option>
          {fit.length > 0 && (
            <optgroup label={`Подходят по тематике · ${fit.length}`}>
              {fit.map((ex) => (
                <option key={ex._id} value={ex.userId}>
                  {ex.fullName}
                </option>
              ))}
            </optgroup>
          )}
          {rest.length > 0 && (
            <optgroup label={fit.length > 0 ? 'Остальные' : 'Все эксперты'}>
              {rest.map((ex) => (
                <option key={ex._id} value={ex.userId}>
                  {ex.fullName}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {executors !== undefined && (
          <span className="text-muted-foreground text-xs">
            {fit.length} из {executors.length} подходят по категории
          </span>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={busy}>
          Отмена
        </Button>
        <Button disabled={busy || !pick} onClick={() => void submit()}>
          {busy ? 'Назначаем…' : 'Назначить'}
          <ArrowRight className="size-4" />
        </Button>
      </DialogFooter>
    </div>
  )
}

// ── Manual status override ────────────────────────────────────────────────────

// The lifecycle in order, plus off-path states. Rendered as a numbered stepper
// so the admin can step forward, roll back, or jump straight to a close.
const STATUS_PIPELINE: OrderStatus[] = [
  'submitted',
  'priced',
  'awaiting_payment',
  'paid',
  'assigned',
  'in_progress',
  'under_review',
  'completed',
  'rated',
]
// `answered` is intentionally absent — the step is retired (admin now closes
// straight from `under_review`); the sweep migrates any legacy stragglers.
const STATUS_OFF_PATH: OrderStatus[] = ['payment_expired', 'rejected', 'cancelled']

/**
 * Admin escape hatch: force the order to any status, bypassing the normal
 * forward-only flow. For rescuing stuck orders, rolling a step back, or closing
 * manually. Collapsed by default so it isn't hit by accident; every change asks
 * for a confirm and is logged to the thread by `orders.adminSetStatus`.
 */
function StatusOverride({ order }: { order: Doc<'orders'> }) {
  const setStatus = useMutation(api.orders.adminSetStatus)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<OrderStatus | null>(null)
  const [busy, setBusy] = useState(false)

  async function confirm() {
    if (!pending) return
    setBusy(true)
    try {
      await setStatus({ orderId: order._id, status: pending })
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-1 flex flex-col gap-2 border-t pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-muted-foreground hover:text-foreground self-start text-xs font-medium"
      >
        {open ? '▾' : '▸'} Изменить статус вручную
      </button>

      {open && (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs">
            Переопределение в обход обычного порядка — для отката или закрытия застрявшей заявки.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_PIPELINE.map((s, i) => (
              <StatusChip
                key={s}
                status={s}
                step={i + 1}
                current={order.status === s}
                disabled={busy}
                onPick={() => setPending(s)}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OFF_PATH.map((s) => (
              <StatusChip
                key={s}
                status={s}
                current={order.status === s}
                disabled={busy}
                onPick={() => setPending(s)}
              />
            ))}
          </div>

          {pending && (
            <div className="bg-secondary/40 flex flex-wrap items-center gap-2 rounded-md border p-2">
              <span className="text-xs">
                Изменить статус на{' '}
                <span className="font-semibold">«{ORDER_STATUS_LABEL[pending]}»</span>?
              </span>
              <div className="ml-auto flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setPending(null)}
                >
                  Отмена
                </Button>
                <Button size="sm" disabled={busy} onClick={() => void confirm()}>
                  {busy ? 'Меняем…' : 'Подтвердить'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatusChip({
  status,
  step,
  current,
  disabled,
  onPick,
}: {
  status: OrderStatus
  step?: number
  current: boolean
  disabled: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      disabled={current || disabled}
      onClick={onPick}
      className={cn(
        `inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium
        transition-colors`,
        current
          ? 'border-primary bg-primary text-primary-foreground cursor-default'
          : 'border-border hover:bg-secondary disabled:opacity-50',
      )}
    >
      {step !== undefined && (
        <span className={cn('tabular-nums', current ? 'opacity-80' : 'text-muted-foreground')}>
          {step}
        </span>
      )}
      {ORDER_STATUS_LABEL[status]}
    </button>
  )
}
