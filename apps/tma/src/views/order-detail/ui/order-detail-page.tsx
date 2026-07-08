'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { Check, RotateCcw, X } from 'lucide-react'

import type { OrderStatus } from '@tax-assistant/validators'
import { Button } from '@tax-assistant/ui/button'
import { Input } from '@tax-assistant/ui/input'
import { formatKopecks } from '@tax-assistant/validators'

import { TmaScreen } from '~/widgets/tma-shell'
import { OrderChat } from '~/features/order-chat'
import { useSession } from '~/entities/session'
import type { Doc, Id } from '~/shared/api'
import { api } from '~/shared/api'
import { cn } from '~/shared/lib'

// Server anonymizes for non-admins (strips customerId + assignedExecutorId),
// so the order shape we get back is the wider, identity-stripped one.
type Order = Omit<Doc<'orders'>, 'customerId' | 'assignedExecutorId'>
type Category = Doc<'categories'>
type Tag = Doc<'tags'>
type Role = 'customer' | 'executor' | 'admin'

const NBSP = ' '

/**
 * /orders/[orderId] — chat-style ticket.
 *
 * Header shows the (anonymized) counterparty: "Налоговый помощник" until an
 * executor is assigned, then "Эксперт" with the topic from the order's tag.
 * The body is a vertical timeline — the original description as the
 * customer's first bubble, then every chat message including system events,
 * then status-driven action cards inline (Оплатить, Принять ответ, …).
 *
 * Identities stay stripped at the read boundary (`orders.get` anonymizes for
 * non-admins, `messages.list` exposes only role labels) — the header is the
 * only place real names could leak, and we intentionally don't surface them.
 */
export function OrderDetailPage({ orderId }: { orderId: Id<'orders'> }) {
  const { isAuthenticated } = useSession()
  const data = useQuery(api.orders.get, isAuthenticated ? { orderId } : 'skip')

  if (!data) {
    return (
      <TmaScreen title="Обращение">
        <div className="text-hint p-6 text-center text-sm">Загрузка…</div>
      </TmaScreen>
    )
  }

  const { order, category, tag, role } = data
  const header = headerFor(role, order, category, tag)
  const orderNum = shortNum(order._id)

  return (
    <TmaScreen
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
      rightAction={
        role === 'executor' && order.status === 'in_progress' ? (
          <ExecutorSubmitReview orderId={order._id} />
        ) : undefined
      }
      bodyClassName="flex flex-col overflow-hidden"
    >
      <OrderChat order={order} role={role} action={<ActionSlot order={order} role={role} />} />
    </TmaScreen>
  )
}

// ─── header label ─────────────────────────────────────────────────────────
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

const ASSIGNED_STATES = new Set<OrderStatus>([
  'assigned',
  'in_progress',
  'under_review',
  'answered',
  'completed',
  'rated',
])

const CUSTOMER_PENDING_LABEL: Partial<Record<OrderStatus, string>> = {
  submitted: 'На проверке',
  priced: 'Стоимость утверждена',
  awaiting_payment: 'Ожидает оплаты',
  payment_expired: 'Оплата просрочена',
  paid: 'Ищем эксперта',
  rejected: 'Отклонена',
  cancelled: 'Отменена',
}

const EXECUTOR_STATE_LABEL: Partial<Record<OrderStatus, string>> = {
  assigned: 'принимает заказ',
  in_progress: 'пишет ответ',
  under_review: 'ответ на проверке',
  answered: 'ответ готов',
  completed: 'заявка завершена',
  rated: 'заявка завершена',
}

// ─── status-driven inline action slot ─────────────────────────────────────
function ActionSlot({ order, role }: { order: Order; role: Role }) {
  const args = { orderId: order._id }
  const cancel = useMutation(api.orders.cancel)
  const startWork = useMutation(api.orders.startWork)

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
          <PayButton orderId={order._id} />
          <Button variant="outline" size="sm" onClick={() => void cancel(args)}>
            <X className="size-3.5" /> Отменить
          </Button>
        </ActionCard>
      )
    }

    if (order.status === 'under_review') {
      return (
        <ActionCard
          tone="work"
          title="Эксперт завершил работу"
          body="Идёт финальная проверка переписки модератором. Скоро заявка закроется."
        />
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
          title="Заявка на проверке"
          body="Проверяем вашу заявку и рассчитываем стоимость. Как только всё будет готово, откроем оплату."
        >
          <Button variant="outline" size="sm" onClick={() => void cancel(args)}>
            <X className="size-3.5" /> Отменить
          </Button>
        </ActionCard>
      )
    }

    if (order.status === 'paid') {
      return (
        <ActionCard
          tone="search"
          title="Ищем эксперта"
          body="Оплата получена — заявка опубликована на бирже. Подходящий эксперт скоро возьмёт её в работу."
        />
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
      return (
        <div className="flex flex-col gap-2">
          {order.answerBody && <AnswerCard body={order.answerBody} />}
          <RatingCard orderId={order._id} />
        </div>
      )
    }

    if (order.status === 'rated') {
      return (
        <div className="flex flex-col gap-2">
          {order.answerBody && <AnswerCard body={order.answerBody} />}
          <ActionCard
            tone="done"
            title="Заявка завершена"
            body={`Ваша оценка ответа: ${order.rating ?? '—'}/10`}
          />
        </div>
      )
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
        <ActionCard
          tone="work"
          title="Диалог с заказчиком"
          body="Отвечайте заказчику в чате ниже. Когда закончите — нажмите «На проверку» сверху, чтобы отправить переписку модератору."
        />
      )
    }
    if (order.status === 'under_review') {
      return (
        <ActionCard
          tone="pay"
          title="Диалог на проверке"
          body="Модератор проверяет переписку. После одобрения заявка закроется, а при доработке вернётся к вам."
        />
      )
    }
  }

  if (role === 'admin') return <AdminActionSlot order={order} />

  return null
}

// ─── admin actions (status-driven) ───────────────────────────────────────
// Mirrors apps/admin's review/payment/assign queues but inline, so an admin
// in the TMA can move an order through its pipeline without context-switching
// to the desktop admin tool.
function AdminActionSlot({ order }: { order: Order }) {
  if (order.status === 'submitted') return <AdminPriceCard orderId={order._id} />
  if (order.status === 'awaiting_payment') return <AdminPaymentCard order={order} />
  if (order.status === 'payment_expired') return <AdminReopenCard orderId={order._id} />
  if (order.status === 'paid') return <AdminAssignCard order={order} />
  if (order.status === 'under_review') return <AdminReviewCard order={order} />
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

  // Split by category fit so the admin sees the best matches first.
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

// ─── customer: pay / answer / rating ─────────────────────────────────────
function PayButton({ orderId }: { orderId: Id<'orders'> }) {
  const checkout = useMutation(api.payments.checkout)
  const [busy, setBusy] = useState(false)
  return (
    <Button
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          const res = await checkout({ orderId })
          if (res.checkoutUrl) window.open(res.checkoutUrl, '_blank')
        } finally {
          setBusy(false)
        }
      }}
    >
      Оплатить
    </Button>
  )
}

/** The executor's formal answer, shown to the customer once admin-approved. */
function AnswerCard({ body }: { body: string }) {
  return (
    <div className="border-status-done/40 bg-status-done-bg rounded-2xl border p-3.5">
      <div className="text-foreground text-sm font-bold">Ответ эксперта</div>
      <div className="text-foreground mt-1.5 text-[14px] leading-relaxed whitespace-pre-wrap">
        {body}
      </div>
    </div>
  )
}

function RatingCard({ orderId }: { orderId: Id<'orders'> }) {
  const rate = useMutation(api.orders.rateOrder)
  const [busy, setBusy] = useState(false)
  return (
    <ActionCard
      tone="done"
      title="Оцените ответ"
      body="Насколько ответ вам помог? 1 — совсем не устраивает, 10 — супер."
    >
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await rate({ orderId, score: n })
            } finally {
              setBusy(false)
            }
          }}
          className="bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground
            flex size-8 items-center justify-center rounded-lg text-sm font-semibold tabular-nums
            transition-colors disabled:opacity-50"
        >
          {n}
        </button>
      ))}
    </ActionCard>
  )
}

// ─── executor: submit dialog for review (header button) ──────────────────
function ExecutorSubmitReview({ orderId }: { orderId: Id<'orders'> }) {
  const submit = useMutation(api.orders.submitForReview)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        setError(false)
        try {
          await submit({ orderId })
        } catch {
          // Most likely EMPTY_DIALOG — the executor hasn't replied yet.
          setError(true)
        } finally {
          setBusy(false)
        }
      }}
      className={cn(
        'text-primary text-[15px] font-semibold disabled:opacity-50',
        error && 'text-status-fail',
      )}
    >
      {busy ? 'Отправка…' : error ? 'Ответьте в чате' : 'На проверку'}
    </button>
  )
}

// ─── admin: dialog review gate ───────────────────────────────────────────
function AdminReviewCard({ order }: { order: Order }) {
  const approve = useMutation(api.orders.approveReview)
  const reject = useMutation(api.orders.rejectReview)
  const [busy, setBusy] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  return (
    <ActionCard
      tone="pay"
      title="Проверка диалога"
      body="Проверьте переписку выше. Одобрите — заявка закроется и эксперт получит начисление; либо верните на доработку."
    >
      {rejecting && (
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Комментарий эксперту (необязательно)"
          disabled={busy}
        />
      )}
      <Button
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await approve({ orderId: order._id })
          } finally {
            setBusy(false)
          }
        }}
      >
        <Check className="size-3.5" /> Одобрить и закрыть
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={async () => {
          if (!rejecting) {
            setRejecting(true)
            return
          }
          setBusy(true)
          try {
            await reject({ orderId: order._id, note: note.trim() })
          } finally {
            setBusy(false)
          }
        }}
      >
        <RotateCcw className="size-3.5" /> На доработку
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

// ─── inline action card ──────────────────────────────────────────────────
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

// ─── helpers ─────────────────────────────────────────────────────────────
function shortNum(id: string): string {
  return id.slice(-4).toUpperCase()
}

const deadlineFmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })

function formatDeadline(ts: number): string {
  return deadlineFmt.format(new Date(ts))
}
