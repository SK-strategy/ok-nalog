'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import { Briefcase, ChevronRight, Search } from 'lucide-react'

import { formatKopecks } from '@tax-assistant/validators'

import { TmaScreen } from '~/widgets/tma-shell'
import { CategorySearchSheet, categoryStyle } from '~/entities/category'
import { ClientTypeSegmented, useClientType } from '~/entities/client-type'
import { OrderRow, OrdersList } from '~/entities/order'
import { useSession } from '~/entities/session'
import type { Doc, Id } from '~/shared/api'
import { api } from '~/shared/api'

type Category = Doc<'categories'>

const NBSP = ' '
const HOME_ORDERS_LIMIT = 3

/**
 * Customer home.
 *  - Search icon opens a keyword search across all visible categories.
 *  - "Ваши обращения" preview at the top (up to 3, with "Все →" when more).
 *    Hidden until the customer has at least one order. Active + closed
 *    obligations all show here — the row's status pill carries the state.
 *  - Client-type selector + 2×N grid of categories.
 *  - MainButton: "+ Новое обращение" by default; if a draft is saved,
 *    "Продолжить черновик" → `/orders/new` (no params, draft hydrates).
 */
export function HomePage() {
  const router = useRouter()
  const [clientType, setClientType] = useClientType()
  const { me, isAuthenticated } = useSession()
  const isExecutor = me?.executor?.status === 'approved'
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
        <button
          type="button"
          aria-label="Поиск"
          className="p-1"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="size-[22px]" />
        </button>
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
        {isExecutor && (
          <ExecutorEntry
            balance={me.executor?.balance ?? 0}
            onOpen={() => router.push('/executor')}
          />
        )}

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

// ─── executor entry (only when me.executor.status === 'approved') ─────────
function ExecutorEntry({ balance, onOpen }: { balance: number; onOpen: () => void }) {
  return (
    <div className="px-4">
      <button
        type="button"
        onClick={onOpen}
        className="bg-primary-soft flex w-full items-center gap-3 rounded-2xl p-4 text-left
          transition-opacity active:opacity-80"
      >
        <div
          className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center
            justify-center rounded-[10px]"
        >
          <Briefcase className="size-5" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-foreground truncate text-sm font-bold">Кабинет эксперта</div>
          <div className="text-text-soft truncate text-xs">
            Баланс{NBSP}
            <span className="text-foreground font-semibold tabular-nums">
              {formatKopecks(balance)}
            </span>
          </div>
        </div>
        <ChevronRight className="text-primary size-[18px]" />
      </button>
    </div>
  )
}
