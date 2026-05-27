'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { ArrowRight } from 'lucide-react'

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
import { formatKopecks, kopecksToRubles, rublesToKopecks } from '@tax-assistant/validators'

import type { Doc, Id } from '~/shared/api'
import { api } from '~/shared/api'
import { formatDateTime, shortId } from '~/shared/lib'
import { OrderStatusBadge } from '~/shared/ui'

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
  onDone,
}: {
  order: Doc<'orders'>
  category: Doc<'categories'> | null
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
        </div>
      </div>

      <StatusForm order={order} onDone={onDone} />
    </>
  )
}

function StatusForm({ order, onDone }: { order: Doc<'orders'>; onDone: () => void }) {
  switch (order.status) {
    case 'submitted':
      return <PriceForm order={order} onDone={onDone} />
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
            ≈ {formatKopecks(rublesToKopecks(priceNum))}. Клиент получит счёт на час.
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
