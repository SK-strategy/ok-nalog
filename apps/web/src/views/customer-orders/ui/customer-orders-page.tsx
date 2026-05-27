'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import { ChevronRight, Clock, Plus, Search, Sparkles, XCircle } from 'lucide-react'

import { formatKopecks } from '@tax-assistant/validators'

import { AuthGate } from '~/features/auth'
import { CategorySearchSheet, categoryStyle } from '~/entities/category'
import { ClientTypeSegmented, useClientType } from '~/entities/client-type'
import { OrderRow, OrdersList } from '~/entities/order'
import { useSession } from '~/entities/session'
import type { Doc, Id } from '~/shared/api'
import { api } from '~/shared/api'

type Category = Doc<'categories'>

const NBSP = ' '
const HOME_ORDERS_LIMIT = 5

/**
 * Customer dashboard. Mirrors apps/tma's HomePage CustomerHome:
 *   - top: preview of recent orders (or empty hint)
 *   - middle: client-type segmented + categories grid
 *   - bottom: become-executor CTA (status-aware)
 *
 * No in-page `PageHeader` — the SiteHeader brand already says "Налоговый
 * помощник", and the dashboard's own H1 ("Здравствуйте, …") is the page
 * identity. The narrow `max-w-3xl` cap from the first port has been bumped
 * to `max-w-6xl` so wider screens (laptop / iPad landscape) actually use
 * the available real estate; categories scale from 2 → 3 → 4 columns.
 */
export function CustomerOrdersPage() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-6 pb-12 sm:px-6 lg:px-8">
      <AuthGate>
        <Dashboard />
      </AuthGate>
    </main>
  )
}

function Dashboard() {
  const router = useRouter()
  const { isAuthenticated, me } = useSession()
  const [clientType, setClientType] = useClientType()
  const categories = useQuery(
    api.categories.listForClientType,
    isAuthenticated ? { clientType } : 'skip',
  )
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

  const ctaHref = hasDraft ? '/orders/new' : `/orders/new?clientType=${clientType}`
  const ctaLabel = hasDraft ? 'Продолжить черновик' : 'Новое обращение'

  return (
    <>
      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-foreground text-2xl leading-tight font-bold tracking-tight">
              Здравствуйте{me ? `, ${me.user.name}` : ''}
            </h1>
            <p className="text-text-soft mt-1 text-sm">
              Выберите категорию или продолжите с обращениями ниже.
            </p>
          </div>
          <button
            type="button"
            aria-label="Поиск по категориям"
            className="text-primary hover:bg-secondary -mr-2 rounded-full p-2"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="size-5" />
          </button>
        </div>

        <Link
          href={ctaHref}
          className="bg-primary text-primary-foreground inline-flex h-12 items-center justify-center
            gap-2 self-start rounded-2xl px-5 text-[15px] font-bold transition-opacity
            hover:opacity-90"
        >
          <Plus className="size-5" />
          {ctaLabel}
        </Link>
      </section>

      {showOrdersSection && (
        <section>
          <SectionHeader title="Ваши обращения">
            {hasMore && (
              <Link
                href="/orders/all"
                className="text-primary -mr-1 flex items-center gap-0.5 px-1 text-[13px]
                  font-semibold"
              >
                Все
                <ChevronRight className="size-3.5" />
              </Link>
            )}
          </SectionHeader>
          {ordersLoading ? (
            <div className="bg-secondary h-28 animate-pulse rounded-2xl" />
          ) : (
            <OrdersList>
              {previewOrders.map((o, i) => (
                <OrderRow
                  key={o._id}
                  order={o}
                  category={categoryById.get(o.categoryId)}
                  isFirst={i === 0}
                  href={`/orders/${o._id}`}
                />
              ))}
            </OrdersList>
          )}
        </section>
      )}

      <ClientTypeSegmented value={clientType} onChange={setClientType} />

      <section>
        <SectionHeader title="Категории" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {categories === undefined &&
            Array.from({ length: 8 }).map((_, i) => <CategorySkeleton key={i} />)}
          {categories?.map((c) => (
            <CategoryTile key={c._id} category={c} onClick={() => openCategory(c._id)} />
          ))}
          {categories?.length === 0 && (
            <div className="bg-secondary col-span-full rounded-2xl p-5 text-center">
              <p className="text-text-soft text-sm">
                Для выбранного типа клиента пока нет категорий.
              </p>
              <p className="text-hint mt-1 text-xs">Попробуйте сменить тип выше.</p>
            </div>
          )}
        </div>
      </section>

      <BecomeExecutorCard executorStatus={me?.executor?.status} />

      <CategorySearchSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(c) => openCategory(c._id)}
        clientType={clientType}
        title="Поиск по категориям"
      />
    </>
  )
}

function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-end justify-between">
      <h2 className="text-hint text-[12px] font-bold tracking-[0.06em] uppercase">{title}</h2>
      {children}
    </div>
  )
}

function CategoryTile({ category, onClick }: { category: Category; onClick: () => void }) {
  const palette = categoryStyle(category.sortOrder)
  const Icon = palette.icon
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-secondary hover:bg-secondary/80 flex min-h-[140px] flex-col justify-between
        rounded-2xl p-4 text-left transition-colors"
    >
      <div
        className="flex size-[44px] items-center justify-center rounded-xl"
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
  return <div className="bg-secondary h-[140px] animate-pulse rounded-2xl" />
}

function BecomeExecutorCard({
  executorStatus,
}: {
  executorStatus: 'pending' | 'approved' | 'rejected' | undefined
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
    <Link
      href="/executor"
      className="bg-card hover:bg-secondary/40 flex items-center gap-3 rounded-2xl border p-4
        transition-colors"
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
    </Link>
  )
}
