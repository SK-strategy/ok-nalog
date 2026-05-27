'use client'

import { useMutation, useQuery } from 'convex/react'
import { Check, RotateCcw, X } from 'lucide-react'

import type { OrderStatus } from '@tax-assistant/validators'
import { Button } from '@tax-assistant/ui/button'
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
      const creds = tag?.specialistCode ?? tag?.name ?? category?.title
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
  submitted: 'На рассмотрении',
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

// ─── status-driven inline action slot ─────────────────────────────────────
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
          {/* TODO: wire Telegram Payments — disabled until the gateway is live */}
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
          title="На рассмотрении"
          body="Администратор проверяет заявку и согласует стоимость."
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

  return null
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
