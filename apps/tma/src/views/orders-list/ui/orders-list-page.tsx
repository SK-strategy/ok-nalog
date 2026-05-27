'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'

import { isTerminal } from '@tax-assistant/validators'

import { TmaScreen } from '~/widgets/tma-shell'
import { OrderRow, OrdersList } from '~/entities/order'
import { useSession } from '~/entities/session'
import type { Doc } from '~/shared/api'
import { api } from '~/shared/api'

type Order = Doc<'orders'>

/**
 * /orders — full list of the customer's obligations, grouped into the
 * Active and Closed sections so they stay scannable when there are many.
 * Reuses the same `OrderRow` as the home preview.
 */
export function OrdersListPage() {
  const router = useRouter()
  const { isAuthenticated } = useSession()
  const orders = useQuery(api.orders.myOrders, isAuthenticated ? {} : 'skip')
  const categories = useQuery(api.categories.listActive, isAuthenticated ? {} : 'skip')

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c._id, c])),
    [categories],
  )

  const { active, closed } = useMemo(() => split(orders ?? []), [orders])

  if (orders === undefined) {
    return (
      <TmaScreen title="Все обращения">
        <div className="flex flex-col gap-3 px-4 pt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-secondary h-16 animate-pulse rounded-2xl" />
          ))}
        </div>
      </TmaScreen>
    )
  }

  if (orders.length === 0) {
    return (
      <TmaScreen title="Все обращения">
        <Empty />
      </TmaScreen>
    )
  }

  return (
    <TmaScreen title="Все обращения">
      <div className="flex flex-col gap-5 pt-3 pb-2">
        {active.length > 0 && (
          <section>
            <Eyebrow>Активные · {active.length}</Eyebrow>
            <OrdersList>
              {active.map((o, i) => (
                <OrderRow
                  key={o._id}
                  order={o}
                  category={categoryById.get(o.categoryId)}
                  isFirst={i === 0}
                  onClick={() => router.push(`/orders/${o._id}`)}
                />
              ))}
            </OrdersList>
          </section>
        )}

        {closed.length > 0 && (
          <section>
            <Eyebrow>Закрытые · {closed.length}</Eyebrow>
            <OrdersList>
              {closed.map((o, i) => (
                <OrderRow
                  key={o._id}
                  order={o}
                  category={categoryById.get(o.categoryId)}
                  isFirst={i === 0}
                  onClick={() => router.push(`/orders/${o._id}`)}
                />
              ))}
            </OrdersList>
          </section>
        )}
      </div>
    </TmaScreen>
  )
}

function split(orders: Order[]): { active: Order[]; closed: Order[] } {
  const active: Order[] = []
  const closed: Order[] = []
  for (const o of orders) {
    if (isTerminal(o.status)) closed.push(o)
    else active.push(o)
  }
  return { active, closed }
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-hint mb-2 ml-5 text-[12px] font-bold tracking-[0.06em] uppercase">
      {children}
    </h2>
  )
}

function Empty() {
  return (
    <div className="flex flex-col items-center gap-2 px-6 pt-16 text-center">
      <p className="text-foreground text-base font-bold">Обращений пока нет</p>
      <p className="text-text-soft text-sm">Вернитесь на главную и задайте первый вопрос.</p>
    </div>
  )
}
