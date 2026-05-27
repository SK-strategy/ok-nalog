'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import { Check, ChevronDown, ChevronRight, Search } from 'lucide-react'

import { formatKopecks, isTerminal } from '@tax-assistant/validators'

import { TmaScreen } from '~/widgets/tma-shell'
import { CategorySearchSheet, categoryStyle } from '~/entities/category'
import { ClientTypeSegmented, useClientType } from '~/entities/client-type'
import { OrderRow, OrdersList } from '~/entities/order'
import { useSession } from '~/entities/session'
import type { Doc, Id } from '~/shared/api'
import { api } from '~/shared/api'

import type { HomeMode } from '../lib/use-home-mode'
import { useHomeMode } from '../lib/use-home-mode'

type Category = Doc<'categories'>
type AssignedOrder = Omit<Doc<'orders'>, 'customerId' | 'assignedExecutorId'>

const NBSP = ' '
const HOME_ORDERS_LIMIT = 3

const MODE_LABEL: Record<HomeMode, string> = {
  customer: 'Заказчик',
  executor: 'Эксперт',
  admin: 'Админ',
}

const MODE_HINT: Record<HomeMode, string> = {
  customer: 'Категории и обращения',
  executor: 'Назначенные заявки',
  admin: 'Все заявки и настройки',
}

/**
 * Home page. Default view follows role: admins land on the admin overview,
 * approved executors on their dashboard, everyone else on the customer
 * catalogue. A header dropdown lets users with multiple roles flip between
 * them (the choice persists across sessions). Admins keep customer/executor
 * access too — admins-who-are-also-executors can switch all three ways.
 */
export function HomePage() {
  const { me } = useSession()
  const isAdmin = me?.user.role === 'admin'
  const isExecutor = me?.executor?.status === 'approved'
  const [explicitMode, setMode] = useHomeMode()

  // Pin the mode to one the user actually has access to — a stale preference
  // shouldn't strand a downgraded user in an empty cabinet.
  const allowed: HomeMode[] = ['customer']
  if (isExecutor) allowed.push('executor')
  if (isAdmin) allowed.push('admin')

  const defaultMode: HomeMode = isAdmin ? 'admin' : isExecutor ? 'executor' : 'customer'
  const requested = explicitMode ?? defaultMode
  const mode: HomeMode = allowed.includes(requested) ? requested : defaultMode

  const switcher =
    allowed.length > 1 ? <ModeSwitcher mode={mode} allowed={allowed} onChange={setMode} /> : null

  if (mode === 'admin') return <AdminHome switcher={switcher} />
  if (mode === 'executor') return <ExecutorHome switcher={switcher} />
  return <CustomerHome switcher={switcher} />
}

// ─── customer view ────────────────────────────────────────────────────────
function CustomerHome({ switcher }: { switcher: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated } = useSession()
  const [clientType, setClientType] = useClientType()
  const categories = useQuery(
    api.categories.listForClientType,
    isAuthenticated ? { clientType } : 'skip',
  )
  // Orders can belong to any segment (a customer may switch between
  // ЮЛ/ИП ↔ ФЛ ↔ НПД), so we resolve their category from the *full* active
  // list — the segment filter only drives the catalogue grid below.
  const allCategories = useQuery(api.categories.listActive, isAuthenticated ? {} : 'skip')
  const orders = useQuery(api.orders.myOrders, isAuthenticated ? {} : 'skip')
  const draft = useQuery(api.drafts.myDraft, isAuthenticated ? {} : 'skip')

  const [searchOpen, setSearchOpen] = useState(false)

  const previewOrders = useMemo(() => (orders ?? []).slice(0, HOME_ORDERS_LIMIT), [orders])
  const categoryById = useMemo(
    () => new Map((allCategories ?? []).map((c) => [c._id, c])),
    [allCategories],
  )
  const hasDraft = !!draft

  const ordersLoading = orders === undefined
  const totalOrders = orders?.length ?? 0
  const showOrdersSection = ordersLoading || totalOrders > 0
  const hasMore = totalOrders > HOME_ORDERS_LIMIT

  const openCategory = (categoryId: Id<'categories'>) => {
    router.push(`/orders/new?categoryId=${categoryId}&clientType=${clientType}`)
  }

  return (
    <TmaScreen
      title="Налоговый помощник"
      back={false}
      rightAction={
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Поиск"
            className="p-1"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="size-[22px]" />
          </button>
          {switcher}
        </div>
      }
      mainButton={
        hasDraft
          ? {
              text: 'Продолжить черновик',
              onClick: () => router.push('/orders/new'),
            }
          : {
              text: '+ Новое обращение',
              onClick: () => router.push(`/orders/new?clientType=${clientType}`),
            }
      }
    >
      <div className="flex flex-col gap-5 pt-3 pb-2">
        {showOrdersSection && (
          <section>
            <SectionHeader title="Ваши обращения">
              {hasMore && (
                <button
                  type="button"
                  onClick={() => router.push('/orders')}
                  className="text-primary -mr-1 flex items-center gap-0.5 px-1 text-[13px]
                    font-semibold"
                >
                  Все
                  <ChevronRight className="size-3.5" />
                </button>
              )}
            </SectionHeader>
            {ordersLoading ? (
              <div className="bg-secondary mx-4 h-28 animate-pulse rounded-2xl" />
            ) : (
              <OrdersList>
                {previewOrders.map((o, i) => (
                  <OrderRow
                    key={o._id}
                    order={o}
                    category={categoryById.get(o.categoryId)}
                    isFirst={i === 0}
                    onClick={() => router.push(`/orders/${o._id}`)}
                  />
                ))}
              </OrdersList>
            )}
          </section>
        )}

        <ClientTypeSegmented value={clientType} onChange={setClientType} />

        <section>
          <SectionHeader title="Категории" />
          <div className="grid grid-cols-2 gap-2.5 px-4">
            {categories === undefined &&
              Array.from({ length: 4 }).map((_, i) => <CategorySkeleton key={i} />)}
            {categories?.map((c) => (
              <CategoryTile key={c._id} category={c} onClick={() => openCategory(c._id)} />
            ))}
            {categories?.length === 0 && (
              <div className="bg-secondary col-span-2 rounded-2xl p-5 text-center">
                <p className="text-text-soft text-sm">
                  Для выбранного типа клиента пока нет категорий.
                </p>
                <p className="text-hint mt-1 text-xs">Попробуйте сменить тип выше.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <CategorySearchSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(c) => openCategory(c._id)}
        clientType={clientType}
        title="Поиск по категориям"
      />
    </TmaScreen>
  )
}

// ─── executor view ────────────────────────────────────────────────────────
function ExecutorHome({ switcher }: { switcher: React.ReactNode }) {
  const router = useRouter()
  const { me, isAuthenticated } = useSession()
  const balance = me?.executor?.balance ?? 0
  const orders = useQuery(api.orders.assignedToMe, isAuthenticated ? {} : 'skip')
  const categories = useQuery(api.categories.listActive, isAuthenticated ? {} : 'skip')

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c._id, c])),
    [categories],
  )
  const { active, closed } = useMemo(() => splitAssigned(orders ?? []), [orders])

  return (
    <TmaScreen title="Кабинет эксперта" back={false} rightAction={switcher}>
      <div className="flex flex-col gap-5 pt-3 pb-2">
        <BalanceCard balance={balance} />

        {orders === undefined ? (
          <OrdersSkeleton />
        ) : orders.length === 0 ? (
          <EmptyState
            title="Назначенных заявок пока нет"
            hint="Откройте кабинет — там подобраны заявки в ваших тематиках, которые можно взять в работу."
          />
        ) : (
          <>
            {active.length > 0 && (
              <OrdersSection
                title={`В работе · ${active.length}`}
                orders={active}
                categoryById={categoryById}
                onOpen={(id) => router.push(`/orders/${id}`)}
              />
            )}
            {closed.length > 0 && (
              <OrdersSection
                title={`Завершённые · ${closed.length}`}
                orders={closed}
                categoryById={categoryById}
                onOpen={(id) => router.push(`/orders/${id}`)}
              />
            )}
          </>
        )}
      </div>
    </TmaScreen>
  )
}

// ─── admin view ───────────────────────────────────────────────────────────
function AdminHome({ switcher }: { switcher: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated } = useSession()
  // listByStatus() with no status returns the 200 most recent orders.
  const orders = useQuery(api.orders.listByStatus, isAuthenticated ? {} : 'skip')
  const categories = useQuery(api.categories.listActive, isAuthenticated ? {} : 'skip')

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c._id, c])),
    [categories],
  )
  const { needsAction, inFlight, done } = useMemo(() => bucketAdmin(orders ?? []), [orders])

  return (
    <TmaScreen title="Админ-панель" back={false} rightAction={switcher}>
      <div className="flex flex-col gap-5 pt-3 pb-2">
        {orders === undefined ? (
          <OrdersSkeleton />
        ) : orders.length === 0 ? (
          <EmptyState title="Заявок пока нет" hint="Новые обращения появятся здесь." />
        ) : (
          <>
            {needsAction.length > 0 && (
              <OrdersSection
                title={`Требует действия · ${needsAction.length}`}
                orders={needsAction}
                categoryById={categoryById}
                onOpen={(id) => router.push(`/orders/${id}`)}
              />
            )}
            {inFlight.length > 0 && (
              <OrdersSection
                title={`В работе · ${inFlight.length}`}
                orders={inFlight}
                categoryById={categoryById}
                onOpen={(id) => router.push(`/orders/${id}`)}
              />
            )}
            {done.length > 0 && (
              <OrdersSection
                title={`Завершённые · ${done.length}`}
                orders={done}
                categoryById={categoryById}
                onOpen={(id) => router.push(`/orders/${id}`)}
              />
            )}
          </>
        )}
      </div>
    </TmaScreen>
  )
}

// ─── mode switcher (small popover dropdown) ───────────────────────────────
function ModeSwitcher({
  mode,
  allowed,
  onChange,
}: {
  mode: HomeMode
  allowed: HomeMode[]
  onChange: (m: HomeMode) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="bg-secondary text-foreground flex items-center gap-1 rounded-lg px-2 py-1
          text-[13px] font-semibold"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {MODE_LABEL[mode]}
        <ChevronDown className="size-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} role="presentation" />
          <div
            className="border-separator bg-background absolute top-full right-0 z-50 mt-1 w-56
              overflow-hidden rounded-xl border shadow-lg"
            role="menu"
          >
            {allowed.map((m) => (
              <ModeOption
                key={m}
                label={MODE_LABEL[m]}
                hint={MODE_HINT[m]}
                selected={mode === m}
                onClick={() => {
                  onChange(m)
                  setOpen(false)
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ModeOption({
  label,
  hint,
  selected,
  onClick,
}: {
  label: string
  hint: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="menuitem"
      className="active:bg-secondary flex w-full items-start gap-3 px-3 py-2.5 text-left"
    >
      <div className="min-w-0 flex-1">
        <div className="text-foreground text-[14px] leading-tight font-semibold">{label}</div>
        <div className="text-text-soft mt-0.5 text-[12px] leading-tight">{hint}</div>
      </div>
      {selected && <Check className="text-primary mt-0.5 size-4 shrink-0" />}
    </button>
  )
}

// ─── shared list primitives ───────────────────────────────────────────────
function OrdersSection({
  title,
  orders,
  categoryById,
  onOpen,
}: {
  title: string
  orders: AssignedOrder[]
  categoryById: Map<Id<'categories'>, Category>
  onOpen: (id: Id<'orders'>) => void
}) {
  return (
    <section>
      <SectionHeader title={title} />
      <OrdersList>
        {orders.map((o, i) => (
          <OrderRow
            key={o._id}
            order={o}
            category={categoryById.get(o.categoryId)}
            isFirst={i === 0}
            onClick={() => onOpen(o._id)}
          />
        ))}
      </OrdersList>
    </section>
  )
}

function OrdersSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-secondary h-16 animate-pulse rounded-2xl" />
      ))}
    </div>
  )
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 pt-10 text-center">
      <p className="text-foreground text-base font-bold">{title}</p>
      <p className="text-text-soft text-sm">{hint}</p>
    </div>
  )
}

// ─── eyebrow + right slot ──────────────────────────────────────────────────
function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-end justify-between px-5">
      <h2 className="text-hint text-[12px] font-bold tracking-[0.06em] uppercase">{title}</h2>
      {children}
    </div>
  )
}

// ─── category tile ─────────────────────────────────────────────────────────
function CategoryTile({ category, onClick }: { category: Category; onClick: () => void }) {
  const palette = categoryStyle(category.sortOrder)
  const Icon = palette.icon
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-secondary flex min-h-[136px] flex-col justify-between rounded-2xl p-3.5
        text-left transition-opacity active:opacity-80"
    >
      <div
        className="flex size-[42px] items-center justify-center rounded-xl"
        style={{ background: palette.bg, color: palette.fg }}
      >
        <Icon className="size-6" strokeWidth={1.8} />
      </div>
      <div>
        <div className="text-foreground text-sm leading-tight font-bold">{category.title}</div>
        <div className="text-hint mt-1 text-xs">
          от{NBSP}
          {formatKopecks(category.basePrice)}
        </div>
      </div>
    </button>
  )
}

function CategorySkeleton() {
  return <div className="bg-secondary h-[136px] animate-pulse rounded-2xl" />
}

// ─── executor balance card ────────────────────────────────────────────────
function BalanceCard({ balance }: { balance: number }) {
  return (
    <div className="bg-primary-soft mx-4 rounded-2xl p-4">
      <div className="text-text-soft text-[12px] font-bold tracking-[0.06em] uppercase">
        Баланс к выплате
      </div>
      <div className="text-foreground mt-1 text-[28px] leading-none font-bold tabular-nums">
        {formatKopecks(balance)}
      </div>
      <div className="text-text-soft mt-1.5 text-[13px]">
        Начисляется после подтверждения заказчиком. Выплаты — администратором.
      </div>
    </div>
  )
}

// Admin queue split: anything where the admin is the one blocking the
// pipeline (pricing, payment confirmation, executor assignment, expiry
// recovery) shows up at the top so it's tappable without scrolling.
const ADMIN_ACTION_STATES = new Set(['submitted', 'awaiting_payment', 'payment_expired', 'paid'])

function bucketAdmin(orders: AssignedOrder[]): {
  needsAction: AssignedOrder[]
  inFlight: AssignedOrder[]
  done: AssignedOrder[]
} {
  const needsAction: AssignedOrder[] = []
  const inFlight: AssignedOrder[] = []
  const done: AssignedOrder[] = []
  for (const o of orders) {
    if (isTerminal(o.status)) done.push(o)
    else if (ADMIN_ACTION_STATES.has(o.status)) needsAction.push(o)
    else inFlight.push(o)
  }
  return { needsAction, inFlight, done }
}

function splitAssigned(orders: AssignedOrder[]): {
  active: AssignedOrder[]
  closed: AssignedOrder[]
} {
  const active: AssignedOrder[] = []
  const closed: AssignedOrder[] = []
  for (const o of orders) {
    if (isTerminal(o.status)) closed.push(o)
    else active.push(o)
  }
  return { active, closed }
}
