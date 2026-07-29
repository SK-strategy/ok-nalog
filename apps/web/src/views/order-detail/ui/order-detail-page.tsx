'use client'

import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery } from 'convex/react'
import { Check, Inbox, RotateCcw, Star, X } from 'lucide-react'

import type { OrderStatus } from '@tax-assistant/validators'
import { Button } from '@tax-assistant/ui/button'
import { Input } from '@tax-assistant/ui/input'
import { StarRating } from '@tax-assistant/ui/star-rating'
import { averageRating, formatKopecks, isTerminal, RATING_MAX } from '@tax-assistant/validators'

import { AuthGate } from '~/features/auth'
import { OrderChat } from '~/features/order-chat'
import { formatRelativeDate, StatusPill } from '~/entities/order'
import { useSession } from '~/entities/session'
import type { Doc, Id } from '~/shared/api'
import { api } from '~/shared/api'
import { categoryStyle, cn } from '~/shared/lib'

type Order = Omit<Doc<'orders'>, 'customerId' | 'assignedExecutorId'>
type Category = Doc<'categories'>
type Tag = Doc<'tags'>
type Role = 'customer' | 'executor' | 'admin'
type ExecutorFace = { nickname: string | null; ratingSum: number; ratingCount: number } | null

const NBSP = ' '

/**
 * /orders/[id] — chat-app layout. Two panes on lg+:
 *
 *   ┌──────────────────┬────────────────────────────────┐
 *   │  Обращения       │  ChatHeader  (← mobile only)   │
 *   │  (sidebar list)  ├────────────────────────────────┤
 *   │  ⚪ Order ABCD    │  OrderChat (timeline + action  │
 *   │  ⚪ Order XYZ12   │              card + composer)  │
 *   │  ...             │                                │
 *   └──────────────────┴────────────────────────────────┘
 *
 * The whole page fills the viewport (`100dvh - SiteHeader`) so the chat
 * composer stays pinned to the bottom regardless of timeline length —
 * the standard Slack / Telegram-desktop pattern. The sidebar lists every
 * order the user is part of (their own + assigned-to-them) so they can
 * jump between conversations without bouncing through /orders.
 *
 * On < lg the sidebar is hidden and the chat fills the full width; a
 * back-chevron in the chat header is the only nav back to /orders.
 */
export function OrderDetailPage({ orderId }: { orderId: string }) {
  return (
    <AuthGate>
      <DetailLayout orderId={orderId as Id<'orders'>} />
    </AuthGate>
  )
}

// Site header is `h-14` (3.5rem). The detail page fills the rest of the
// viewport so panes scroll internally instead of the document.
const PAGE_HEIGHT = 'h-[calc(100dvh-3.5rem)]'

function DetailLayout({ orderId }: { orderId: Id<'orders'> }) {
  const { isAuthenticated } = useSession()
  const data = useQuery(api.orders.get, isAuthenticated ? { orderId } : 'skip')

  if (!data) {
    return (
      <div className={cn(PAGE_HEIGHT, 'flex')}>
        <OrdersSidebar currentOrderId={orderId} />
        <div className="text-hint flex flex-1 items-center justify-center p-8 text-sm">
          Загрузка…
        </div>
      </div>
    )
  }

  const { order, category, tag, role, executor } = data

  return (
    <div className={cn(PAGE_HEIGHT, 'flex')}>
      <OrdersSidebar currentOrderId={orderId} />
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatHeader order={order} category={category} tag={tag} role={role} executor={executor} />
        <OrderChat order={order} role={role} action={<ActionSlot order={order} role={role} />} />
      </div>
    </div>
  )
}

// ─── orders sidebar ──────────────────────────────────────────────────────
// Lists every order the user can act on (own customer-side + assigned as
// executor), deduped, sorted by most recent. Hidden on < lg because there
// isn't room for a 320px column next to the chat. The current order is
// always rendered first (even if it's somehow not in the union — e.g.
// admins viewing arbitrary orders from the web app).
function OrdersSidebar({ currentOrderId }: { currentOrderId: Id<'orders'> }) {
  const { isAuthenticated, me } = useSession()
  const myOrders = useQuery(api.orders.myOrders, isAuthenticated ? {} : 'skip')
  // `assignedToMe` requires an executor profile; querying it for a
  // customer-only user just returns []. Worth the extra wire call to keep
  // both surfaces in one sidebar — no role-specific branching needed here.
  const hasExecutor = me?.executor !== null && me?.executor !== undefined
  const assigned = useQuery(api.orders.assignedToMe, hasExecutor ? {} : 'skip')
  const categories = useQuery(api.categories.listActive, isAuthenticated ? {} : 'skip')

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c._id, c])),
    [categories],
  )

  const orders = useMemo<Order[]>(() => {
    const seen = new Set<Id<'orders'>>()
    const list: Order[] = []
    for (const source of [myOrders ?? [], assigned ?? []]) {
      for (const o of source) {
        if (seen.has(o._id)) continue
        seen.add(o._id)
        list.push(o)
      }
    }
    list.sort((a, b) => b.createdAt - a.createdAt)
    return list
  }, [myOrders, assigned])

  const { active, closed } = useMemo(() => splitOrders(orders), [orders])

  const loading = myOrders === undefined || (hasExecutor && assigned === undefined)

  return (
    <aside
      className="border-separator hidden w-80 shrink-0 flex-col border-r lg:flex"
      aria-label="Список обращений"
    >
      <header
        className="border-separator flex h-12 shrink-0 items-center justify-between border-b px-4"
      >
        <h2 className="text-foreground text-[13px] font-bold tracking-tight">Обращения</h2>
        <span className="text-hint text-[12px] tabular-nums">{loading ? '' : orders.length}</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <SidebarSkeleton />
        ) : orders.length === 0 ? (
          <SidebarEmpty />
        ) : (
          <>
            {active.length > 0 && (
              <SidebarSection title={`Активные · ${active.length}`}>
                {active.map((o) => (
                  <SidebarRow
                    key={o._id}
                    order={o}
                    category={categoryById.get(o.categoryId)}
                    active={o._id === currentOrderId}
                  />
                ))}
              </SidebarSection>
            )}
            {closed.length > 0 && (
              <SidebarSection title={`Закрытые · ${closed.length}`}>
                {closed.map((o) => (
                  <SidebarRow
                    key={o._id}
                    order={o}
                    category={categoryById.get(o.categoryId)}
                    active={o._id === currentOrderId}
                  />
                ))}
              </SidebarSection>
            )}
          </>
        )}
      </div>
    </aside>
  )
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pb-2">
      <div
        className="text-hint bg-background sticky top-0 z-[1] px-4 pt-3 pb-1.5 text-[11px] font-bold
          tracking-[0.06em] uppercase"
      >
        {title}
      </div>
      <div>{children}</div>
    </section>
  )
}

function SidebarRow({
  order,
  category,
  active,
}: {
  order: Order
  category: Category | undefined
  active: boolean
}) {
  const palette = category ? categoryStyle(category.sortOrder) : null
  const Icon = palette?.icon
  return (
    <Link
      href={`/orders/${order._id}`}
      className={cn(
        'relative flex items-start gap-3 px-4 py-2.5 transition-colors',
        active
          ? `bg-primary-soft before:bg-primary before:absolute before:top-1 before:bottom-1
            before:left-0 before:w-0.5 before:rounded-r-full before:content-[""]`
          : 'hover:bg-secondary/60',
      )}
    >
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-[10px]"
        style={palette ? { background: palette.bg, color: palette.fg } : undefined}
      >
        {Icon ? <Icon className="size-[18px]" strokeWidth={1.8} /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="text-foreground min-w-0 flex-1 truncate text-[14px] font-semibold">
            {category?.title ?? 'Обращение'}
          </div>
          <span className="text-hint shrink-0 text-[11px] tabular-nums">
            {formatRelativeDate(order.createdAt)}
          </span>
        </div>
        <p className="text-text-soft mt-0.5 line-clamp-1 text-[12px] leading-snug">
          {order.description}
        </p>
        <div className="mt-1.5">
          <StatusPill status={order.status} />
        </div>
      </div>
    </Link>
  )
}

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-secondary h-14 animate-pulse rounded-xl" />
      ))}
    </div>
  )
}

function SidebarEmpty() {
  return (
    <div className="text-text-soft flex flex-col items-center gap-2 px-6 pt-10 text-center">
      <div className="text-hint">
        <Inbox className="size-7" strokeWidth={1.6} />
      </div>
      <p className="text-foreground text-[14px] font-bold">Пока пусто</p>
      <p className="text-[12px] leading-snug">
        Создайте первое обращение или дождитесь назначения заявки.
      </p>
      <Link href="/orders" className="text-primary mt-2 text-[13px] font-semibold">
        К каталогу →
      </Link>
    </div>
  )
}

function splitOrders(orders: Order[]): { active: Order[]; closed: Order[] } {
  const active: Order[] = []
  const closed: Order[] = []
  for (const o of orders) {
    if (isTerminal(o.status)) closed.push(o)
    else active.push(o)
  }
  return { active, closed }
}

// ─── chat header (right pane top bar) ────────────────────────────────────
// No back-chevron here — mobile users navigate via the SiteHeader's mobile
// menu (it has a "Мои заявки" entry) or the browser back button. Status
// pill always visible so the ticket state is legible without scrolling.
function ChatHeader({
  order,
  category,
  tag,
  role,
  executor,
}: {
  order: Order
  category: Category | null
  tag: Tag | null
  role: Role
  executor: ExecutorFace
}) {
  const header = headerFor(role, order, category, tag, executor)
  const orderNum = shortNum(order._id)
  return (
    <header className="border-separator flex h-14 shrink-0 items-center gap-3 border-b px-4">
      <div className="min-w-0 flex-1">
        <div className="text-foreground truncate text-[14px] leading-tight font-bold">
          {header.title}
        </div>
        <div className="text-hint truncate text-[11.5px] leading-tight">
          {header.subtitle}
          <span className="text-hint/70 mx-1">·</span>
          <span className="tabular-nums">
            №{NBSP}
            {orderNum}
          </span>
        </div>
      </div>
      {role === 'executor' && order.status === 'in_progress' && (
        <ExecutorSubmitReview orderId={order._id} />
      )}
      <StatusPill status={order.status} />
    </header>
  )
}

function headerFor(
  role: Role,
  order: Order,
  category: Category | null,
  tag: Tag | null,
  executor: ExecutorFace,
): { title: string; subtitle: ReactNode } {
  const assigned = ASSIGNED_STATES.has(order.status)
  if (role === 'customer') {
    if (assigned) {
      const creds = tag?.name ?? category?.title
      const credLabel = creds ? `по ${creds}` : (EXECUTOR_STATE_LABEL[order.status] ?? 'В работе')
      const rated = executor && executor.ratingCount > 0
      return {
        // Identity-hiding handle instead of the real name; generic fallback
        // for profiles created before nicknames existed.
        title: executor?.nickname ?? 'Эксперт',
        subtitle: rated ? (
          <span className="inline-flex items-center gap-1.5">
            <StarRating
              value={averageRating(executor.ratingSum, executor.ratingCount)}
              showValue={false}
            />
            <span>· {credLabel}</span>
          </span>
        ) : (
          credLabel
        ),
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
            body={
              order.rating ? (
                <span className="inline-flex items-center gap-1.5">
                  Ваша оценка: <StarRating value={order.rating} showValue={false} />
                </span>
              ) : (
                'Заявка закрыта.'
              )
            }
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
          body="Отвечайте заказчику в чате ниже. Когда закончите — нажмите «На проверку» в шапке, чтобы отправить переписку модератору."
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

// ─── admin action cards (status-driven) ──────────────────────────────────
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
  const [hover, setHover] = useState(0)
  return (
    <ActionCard
      tone="done"
      title="Оцените ответ"
      body="Насколько эксперт вам помог? 1 звезда — совсем нет, 5 — отлично."
    >
      <div className="flex items-center gap-1.5" onMouseLeave={() => setHover(0)}>
        {Array.from({ length: RATING_MAX }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            disabled={busy}
            aria-label={`Оценка ${n} из ${RATING_MAX}`}
            onMouseEnter={() => setHover(n)}
            onClick={async () => {
              setBusy(true)
              try {
                await rate({ orderId, score: n })
              } finally {
                setBusy(false)
              }
            }}
            className="p-0.5 transition-transform hover:scale-110 active:scale-90
              disabled:opacity-50"
          >
            <Star
              className={cn(
                'size-8',
                n <= hover ? 'fill-amber-400 text-amber-400' : 'text-foreground/25',
              )}
            />
          </button>
        ))}
      </div>
    </ActionCard>
  )
}

// ─── executor: submit dialog for review (header button) ──────────────────
function ExecutorSubmitReview({ orderId }: { orderId: Id<'orders'> }) {
  const submit = useMutation(api.orders.submitForReview)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  return (
    <Button
      size="sm"
      disabled={busy}
      variant={error ? 'destructive' : 'default'}
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
    >
      <Check className="size-3.5" />
      {busy ? 'Отправка…' : error ? 'Ответьте в чате' : 'На проверку'}
    </Button>
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
