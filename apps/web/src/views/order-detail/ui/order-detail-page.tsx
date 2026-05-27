'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { Check, RotateCcw, X } from 'lucide-react'

import type { OrderStatus } from '@tax-assistant/validators'
import { Button } from '@tax-assistant/ui/button'
import { Input } from '@tax-assistant/ui/input'
import { formatKopecks } from '@tax-assistant/validators'

import { PageHeader } from '~/widgets/page-header'
import { AuthGate } from '~/features/auth'
import { OrderChat } from '~/features/order-chat'
import { useSession } from '~/entities/session'
import type { Doc, Id } from '~/shared/api'
import { api } from '~/shared/api'
import { cn } from '~/shared/lib'

type Order = Omit<Doc<'orders'>, 'customerId' | 'assignedExecutorId'>
type Category = Doc<'categories'>
type Tag = Doc<'tags'>
type Role = 'customer' | 'executor' | 'admin'

const NBSP = ' '

/**
 * /orders/[id] — chat-style ticket. Mirrors apps/tma's order detail:
 * anonymized counterparty header, chat timeline (incl. system events),
 * status-driven action cards rendered inline above the composer.
 */
export function OrderDetailPage({ orderId }: { orderId: string }) {
  return (
    <AuthGate>
      <Detail orderId={orderId as Id<'orders'>} />
    </AuthGate>
  )
}

function Detail({ orderId }: { orderId: Id<'orders'> }) {
  const { isAuthenticated } = useSession()
  const data = useQuery(api.orders.get, isAuthenticated ? { orderId } : 'skip')

  if (!data) {
    return (
      <>
        <PageHeader title="Обращение" back="/orders" />
        <div className="text-hint p-8 text-center text-sm">Загрузка…</div>
      </>
    )
  }

  const { order, category, tag, role } = data
  const header = headerFor(role, order, category, tag)
  const orderNum = shortNum(order._id)

  return (
    <>
      <PageHeader
        title={header.title}
        subtitle={
          <span>
            {header.subtitle}
            <span className="text-hint/70 mx-1">·</span>
            <span className="tabular-nums">
              №{NBSP}
              {orderNum}
            </span>
          </span>
        }
        back="/orders"
      />
      <main
        className="bg-background mx-auto flex h-[calc(100dvh-7rem)] max-w-3xl flex-col
          overflow-hidden sm:my-4 sm:h-[calc(100dvh-9rem)] sm:rounded-2xl sm:border sm:shadow-sm"
      >
        <OrderChat order={order} role={role} action={<ActionSlot order={order} role={role} />} />
      </main>
    </>
  )
}

function headerFor(
  role: Role,
  order: Order,
  category: Category | null,
  tag: Tag | null,
): { title: string; subtitle: string } {
  const assigned = ASSIGNED_STATES.has(order.status)
  if (role === 'customer') {
    if (assigned) {
      const creds = tag?.name ?? category?.title
      return {
        title: 'Эксперт',
        subtitle: creds ? `по ${creds}` : (EXECUTOR_STATE_LABEL[order.status] ?? 'В работе'),
      }
    }
    return {
      title: 'Налоговый помощник',
      subtitle: CUSTOMER_PENDING_LABEL[order.status] ?? 'В обработке',
    }
  }
  if (role === 'executor') {
    return { title: 'Заказчик', subtitle: category?.title ?? 'Обращение' }
  }
  return { title: 'Обращение', subtitle: category?.title ?? '' }
}

const ASSIGNED_STATES = new Set<OrderStatus>(['assigned', 'in_progress', 'answered', 'completed'])

const CUSTOMER_PENDING_LABEL: Partial<Record<OrderStatus, string>> = {
  submitted: 'Ищем эксперта',
  priced: 'Стоимость утверждена',
  awaiting_payment: 'Ожидает оплаты',
  payment_expired: 'Оплата просрочена',
  paid: 'Подбираем эксперта',
  rejected: 'Отклонена',
  cancelled: 'Отменена',
}

const EXECUTOR_STATE_LABEL: Partial<Record<OrderStatus, string>> = {
  assigned: 'принимает заказ',
  in_progress: 'пишет ответ',
  answered: 'ответ готов',
  completed: 'заявка завершена',
}

function ActionSlot({ order, role }: { order: Order; role: Role }) {
  const args = { orderId: order._id }
  const cancel = useMutation(api.orders.cancel)
  const complete = useMutation(api.orders.complete)
  const requestRevision = useMutation(api.orders.requestRevision)
  const startWork = useMutation(api.orders.startWork)
  const deliverAnswer = useMutation(api.orders.deliverAnswer)

  if (role === 'customer') {
    if (order.status === 'awaiting_payment') {
      return (
        <ActionCard
          tone="pay"
          title="Ожидает оплаты"
          body={
            <>
              К оплате{NBSP}
              <span className="text-foreground font-bold">
                {formatKopecks(order.approvedPrice ?? order.quotedPrice)}
              </span>
              {order.paymentDeadlineAt && (
                <>
                  {NBSP}· до{NBSP}
                  {formatDeadline(order.paymentDeadlineAt)}
                </>
              )}
            </>
          }
        >
          {/* TODO: wire Telegram Payments / ЮKassa — disabled until gateway is live */}
          <Button size="sm" disabled>
            Оплатить
          </Button>
          <Button variant="outline" size="sm" onClick={() => void cancel(args)}>
            <X className="size-3.5" /> Отменить
          </Button>
        </ActionCard>
      )
    }

    if (order.status === 'priced') {
      return (
        <ActionCard
          tone="pay"
          title="Стоимость утверждена"
          body={
            <>
              К оплате{NBSP}
              <span className="text-foreground font-bold">
                {formatKopecks(order.approvedPrice ?? order.quotedPrice)}
              </span>
              . Ожидаем открытие платежа.
            </>
          }
        >
          <Button variant="outline" size="sm" onClick={() => void cancel(args)}>
            <X className="size-3.5" /> Отменить
          </Button>
        </ActionCard>
      )
    }

    if (order.status === 'payment_expired') {
      return (
        <ActionCard
          tone="fail"
          title="Срок оплаты истёк"
          body="Свяжитесь с поддержкой, чтобы открыть оплату повторно."
        >
          <Button variant="outline" size="sm" onClick={() => void cancel(args)}>
            <X className="size-3.5" /> Отменить
          </Button>
        </ActionCard>
      )
    }

    if (order.status === 'submitted') {
      return (
        <ActionCard
          tone="search"
          title="Ищем эксперта"
          body="Ваша заявка опубликована — подходящий эксперт возьмёт её в работу."
        >
          <Button variant="outline" size="sm" onClick={() => void cancel(args)}>
            <X className="size-3.5" /> Отменить
          </Button>
        </ActionCard>
      )
    }

    if (order.status === 'answered') {
      return (
        <ActionCard
          tone="done"
          title="Эксперт прислал ответ"
          body="Подтвердите получение или попросите доработку."
        >
          <Button size="sm" onClick={() => void complete(args)}>
            <Check className="size-3.5" /> Принять
          </Button>
          <Button variant="outline" size="sm" onClick={() => void requestRevision(args)}>
            <RotateCcw className="size-3.5" /> Доработать
          </Button>
        </ActionCard>
      )
    }

    if (order.status === 'rejected') {
      return (
        <ActionCard
          tone="fail"
          title="Заявка отклонена"
          body={order.rejectionReason ?? 'Без указания причины.'}
        />
      )
    }

    if (order.status === 'cancelled') {
      return <ActionCard tone="fail" title="Заявка отменена" />
    }

    if (order.status === 'completed') {
      return <ActionCard tone="done" title="Заявка завершена" />
    }
  }

  if (role === 'executor') {
    if (order.status === 'assigned') {
      return (
        <ActionCard tone="work" title="Назначены вам" body="Начните работу, когда будете готовы.">
          <Button size="sm" onClick={() => void startWork(args)}>
            Взять в работу
          </Button>
        </ActionCard>
      )
    }
    if (order.status === 'in_progress') {
      return (
        <ActionCard tone="work" title="В работе" body="Подготовьте ответ и отправьте заказчику.">
          <Button size="sm" onClick={() => void deliverAnswer(args)}>
            Отправить ответ
          </Button>
        </ActionCard>
      )
    }
  }

  if (role === 'admin') return <AdminActionSlot order={order} />

  return null
}

// ─── admin action cards (status-driven) ──────────────────────────────────
function AdminActionSlot({ order }: { order: Order }) {
  if (order.status === 'submitted') return <AdminPriceCard orderId={order._id} />
  if (order.status === 'awaiting_payment') return <AdminPaymentCard order={order} />
  if (order.status === 'payment_expired') return <AdminReopenCard orderId={order._id} />
  if (order.status === 'paid') return <AdminAssignCard order={order} />
  return null
}

function AdminPriceCard({ orderId }: { orderId: Id<'orders'> }) {
  const approvePrice = useMutation(api.orders.approvePrice)
  const reject = useMutation(api.orders.reject)
  const [price, setPrice] = useState('')
  const [reasonOpen, setReasonOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const kopecks = priceToKopecks(price)

  async function doApprove() {
    if (!kopecks) return
    setBusy(true)
    try {
      await approvePrice({ orderId, approvedPrice: kopecks })
    } finally {
      setBusy(false)
    }
  }

  async function doReject() {
    const trimmed = reason.trim()
    if (!trimmed) return
    setBusy(true)
    try {
      await reject({ orderId, reason: trimmed })
    } finally {
      setBusy(false)
    }
  }

  if (reasonOpen) {
    return (
      <ActionCard tone="fail" title="Отклонить заявку" body="Причина будет видна заказчику.">
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Например: недостаточно данных"
          disabled={busy}
        />
        <Button size="sm" disabled={busy || !reason.trim()} onClick={() => void doReject()}>
          Отклонить
        </Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => setReasonOpen(false)}>
          Назад
        </Button>
      </ActionCard>
    )
  }

  return (
    <ActionCard
      tone="search"
      title="Утвердить стоимость"
      body="Введите цену в рублях — заявка сразу откроется для оплаты."
    >
      <Input
        inputMode="decimal"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder="₽"
        disabled={busy}
        className="max-w-[140px]"
      />
      <Button size="sm" disabled={busy || !kopecks} onClick={() => void doApprove()}>
        Утвердить
      </Button>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => setReasonOpen(true)}>
        <X className="size-3.5" /> Отклонить
      </Button>
    </ActionCard>
  )
}

function AdminPaymentCard({ order }: { order: Order }) {
  const markPaid = useMutation(api.orders.markPaid)
  const [busy, setBusy] = useState(false)
  return (
    <ActionCard
      tone="pay"
      title="Ожидает оплаты"
      body={
        <>
          К оплате{NBSP}
          <span className="text-foreground font-bold">
            {formatKopecks(order.approvedPrice ?? order.quotedPrice)}
          </span>
          . Подтвердите вручную, если оплата уже прошла.
        </>
      }
    >
      <Button
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await markPaid({ orderId: order._id })
          } finally {
            setBusy(false)
          }
        }}
      >
        Отметить оплаченной
      </Button>
    </ActionCard>
  )
}

function AdminReopenCard({ orderId }: { orderId: Id<'orders'> }) {
  const reopen = useMutation(api.orders.reopenPayment)
  const [busy, setBusy] = useState(false)
  return (
    <ActionCard
      tone="fail"
      title="Срок оплаты истёк"
      body="Откройте оплату повторно, чтобы продлить окно для заказчика."
    >
      <Button
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await reopen({ orderId })
          } finally {
            setBusy(false)
          }
        }}
      >
        <RotateCcw className="size-3.5" /> Открыть повторно
      </Button>
    </ActionCard>
  )
}

function AdminAssignCard({ order }: { order: Order }) {
  const assign = useMutation(api.orders.assignExecutor)
  const executors = useQuery(api.executors.listApproved, {})
  const [pick, setPick] = useState<string>('')
  const [busy, setBusy] = useState(false)

  const { fit, rest } = useMemo(() => {
    const fit: Doc<'executorProfiles'>[] = []
    const rest: Doc<'executorProfiles'>[] = []
    for (const ex of executors ?? []) {
      if (ex.categoryIds.includes(order.categoryId)) fit.push(ex)
      else rest.push(ex)
    }
    return { fit, rest }
  }, [executors, order.categoryId])

  async function doAssign() {
    if (!pick) return
    setBusy(true)
    try {
      await assign({ orderId: order._id, executorUserId: pick as Id<'users'> })
    } finally {
      setBusy(false)
    }
  }

  return (
    <ActionCard
      tone="work"
      title="Подобрать исполнителя"
      body="Назначьте эксперта на оплаченную заявку."
    >
      <select
        className="border-input bg-background h-9 w-full min-w-0 rounded-md border px-2 text-sm
          outline-none"
        value={pick}
        onChange={(e) => setPick(e.target.value)}
        disabled={busy || executors === undefined}
      >
        <option value="">— исполнитель —</option>
        {fit.length > 0 && (
          <optgroup label={`Подходящие · ${fit.length}`}>
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
      <Button size="sm" disabled={busy || !pick} onClick={() => void doAssign()}>
        Назначить
      </Button>
    </ActionCard>
  )
}

function priceToKopecks(input: string): number | null {
  const cleaned = input.replace(/\s/g, '').replace(',', '.')
  const rubles = Number.parseFloat(cleaned)
  if (!Number.isFinite(rubles) || rubles <= 0) return null
  return Math.round(rubles * 100)
}

type Tone = 'search' | 'pay' | 'work' | 'done' | 'fail'

const TONE_CLASS: Record<Tone, string> = {
  search: 'border-status-search/40 bg-status-search-bg',
  pay: 'border-status-pay/40 bg-status-pay-bg',
  work: 'border-status-work/40 bg-status-work-bg',
  done: 'border-status-done/40 bg-status-done-bg',
  fail: 'border-status-fail/40 bg-status-fail-bg',
}

function ActionCard({
  tone,
  title,
  body,
  children,
}: {
  tone: Tone
  title: string
  body?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className={cn('rounded-2xl border p-3.5', TONE_CLASS[tone])}>
      <div className="text-foreground text-sm font-bold">{title}</div>
      {body && <div className="text-text-soft mt-1 text-[13px] leading-relaxed">{body}</div>}
      {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}

function shortNum(id: string): string {
  return id.slice(-4).toUpperCase()
}

const deadlineFmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })

function formatDeadline(ts: number): string {
  return deadlineFmt.format(new Date(ts))
}
