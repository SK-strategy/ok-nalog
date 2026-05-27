'use client'

import { useMemo } from 'react'
import { useQuery } from 'convex/react'

import { isTerminal } from '@tax-assistant/validators'

import { AuthGate } from '~/features/auth'
import { OrderRow, OrdersList } from '~/entities/order'
import { useSession } from '~/entities/session'
import type { Doc } from '~/shared/api'
import { api } from '~/shared/api'

type Order = Doc<'orders'>

/**
 * Full list of the customer's obligations, split into Active and Closed
 * sections. Mirrors apps/tma's /orders page.
 */
export function OrdersListPage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 pt-6 pb-12 sm:px-6">
      <h1 className="text-foreground text-2xl leading-tight font-bold tracking-tight">
        Все обращения
      </h1>
      <AuthGate>
        <Content />
      </AuthGate>
    </main>
  )
}

function Content() {
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
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-secondary h-16 animate-pulse rounded-2xl" />
        ))}
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 pt-16 text-center">
        <p className="text-foreground text-base font-bold">Обращений пока нет</p>
        <p className="text-text-soft text-sm">Вернитесь на главную и задайте первый вопрос.</p>
      </div>
    )
  }

  return (
    <>
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
                href={`/orders/${o._id}`}
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
                href={`/orders/${o._id}`}
              />
            ))}
          </OrdersList>
        </section>
      )}
    </>
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
    <h2 className="text-hint mb-2 text-[12px] font-bold tracking-[0.06em] uppercase">{children}</h2>
  )
}
