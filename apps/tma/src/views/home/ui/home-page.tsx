'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import { ChevronRight, Clock, Search, Sparkles, XCircle } from 'lucide-react'

import { formatKopecks, isTerminal } from '@tax-assistant/validators'

import type { HomeMode } from '~/widgets/mode-switcher'
import { ModeSwitcher, useHomeMode } from '~/widgets/mode-switcher'
import { TmaScreen } from '~/widgets/tma-shell'
import { LinkEmailCard } from '~/features/link-email'
import { CategorySearchSheet, categoryStyle } from '~/entities/category'
import { ClientTypeSegmented, useClientType } from '~/entities/client-type'
import { OrderRow, OrdersList } from '~/entities/order'
import { useSession } from '~/entities/session'
import type { Doc, Id } from '~/shared/api'
import { api } from '~/shared/api'

type Category = Doc<'categories'>
type AssignedOrder = Omit<Doc<'orders'>, 'customerId' | 'assignedExecutorId'>

const NBSP = ' '
const HOME_ORDERS_LIMIT = 3

/**
 * Home page. Default view follows role: admins land on the admin overview,
 * approved executors on their cabinet at /executor (this page redirects to
 * it), everyone else on the customer catalogue. A header dropdown lets
 * users with multiple roles flip between dashboards — it persists the
 * choice and navigates to the canonical route for the new mode.
 */
export function HomePage() {
  const router = useRouter()
  const { me } = useSession()
  const isAdmin = me?.user.role === 'admin'
  const isExecutor = me?.executor?.status === 'approved'
  const [explicitMode, , hydrated] = useHomeMode()

  // Pin the mode to one the user actually has access to — a stale preference
  // shouldn't strand a downgraded user in an empty cabinet.
  const allowed: HomeMode[] = ['customer']
  if (isExecutor) allowed.push('executor')
  if (isAdmin) allowed.push('admin')

  const defaultMode: HomeMode = isAdmin ? 'admin' : isExecutor ? 'executor' : 'customer'
  const requested = explicitMode ?? defaultMode
  const mode: HomeMode = allowed.includes(requested) ? requested : defaultMode

  // The executor cabinet is its own route. When the resolved mode lands on
  // executor at `/`, bounce to /executor so the user sees the full surface
  // (available pool, claim flow, balance, анкета) instead of a stripped
  // home-embedded view. Wait for the persisted preference to hydrate first;
  // otherwise switching back to "Заказчик" from /executor would race the
  // localStorage read and bounce right back.
  useEffect(() => {
    if (!hydrated) return
    if (mode === 'executor') router.replace('/executor')
  }, [hydrated, mode, router])

  // Hold the screen blank during hydration + redirect rather than flashing
  // the wrong dashboard.
  if (!hydrated || mode === 'executor') return <div className="bg-background h-full" />

  const switcher = <ModeSwitcher current={mode} allowed={allowed} />

  if (mode === 'admin') return <AdminHome switcher={switcher} />
  return <CustomerHome switcher={switcher} />
}

// ─── customer view ────────────────────────────────────────────────────────
function CustomerHome({ switcher }: { switcher: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, me } = useSession()
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

        <BecomeExecutorCard
          executorStatus={me?.executor?.status}
          onOpen={() => router.push('/executor')}
        />

        <LinkEmailCard />
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

// ─── become-executor entry point ─────────────────────────────────────────
// Approved executors already have the mode switcher; the rest of the world
// gets a discreet card on the customer home — status-aware so a pending or
// rejected user lands on the right screen rather than a generic prompt.
function BecomeExecutorCard({
  executorStatus,
  onOpen,
}: {
  executorStatus: 'pending' | 'approved' | 'rejected' | undefined
  onOpen: () => void
}) {
  if (executorStatus === 'approved') return null

  const config =
    executorStatus === 'pending'
      ? {
          icon: <Clock className="size-5" strokeWidth={1.8} />,
          tone: 'pending' as const,
          title: 'Анкета на проверке',
          body: 'Администратор рассматривает вашу заявку. Откройте, чтобы посмотреть, что отправили.',
          cta: 'Открыть',
        }
      : executorStatus === 'rejected'
        ? {
            icon: <XCircle className="size-5" strokeWidth={1.8} />,
            tone: 'rejected' as const,
            title: 'Анкета не прошла проверку',
            body: 'Поправьте анкету и отправьте её на повторное рассмотрение.',
            cta: 'Поправить',
          }
        : {
            icon: <Sparkles className="size-5" strokeWidth={1.8} />,
            tone: 'primary' as const,
            title: 'Стать экспертом',
            body: 'Консультируйте по своей теме и получайте вознаграждение. Несколько минут на анкету.',
            cta: 'Подать анкету',
          }

  const toneClasses =
    config.tone === 'rejected'
      ? 'bg-destructive/10 text-destructive'
      : config.tone === 'pending'
        ? 'bg-status-pay-bg text-status-pay'
        : 'bg-primary-soft text-primary'

  return (
    <button
      type="button"
      onClick={onOpen}
      className="bg-card mx-4 flex items-center gap-3 rounded-2xl p-4 text-left transition-opacity
        active:opacity-80"
    >
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-[10px] ${toneClasses}`}
      >
        {config.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-[14px] font-semibold">{config.title}</p>
        <p className="text-text-soft mt-0.5 text-[12px] leading-snug">{config.body}</p>
      </div>
      <span className="text-primary shrink-0 text-[13px] font-semibold">{config.cta}</span>
    </button>
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
