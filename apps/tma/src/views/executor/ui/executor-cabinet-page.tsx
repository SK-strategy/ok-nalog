'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import { Briefcase } from 'lucide-react'

import { formatKopecks, isTerminal } from '@tax-assistant/validators'

import { TmaScreen } from '~/widgets/tma-shell'
import { OrderRow, OrdersList } from '~/entities/order'
import { useSession } from '~/entities/session'
import type { Doc } from '~/shared/api'
import { api } from '~/shared/api'

type Order = Omit<Doc<'orders'>, 'customerId' | 'assignedExecutorId'>

/**
 * /executor — executor cabinet. Lists every order assigned to this user,
 * split into Active (still in flight) and Closed (terminal). Balance card
 * at the top mirrors what's accrued in `executorProfiles.balance` —
 * payouts zero it server-side.
 *
 * Gated softly: if the user isn't an approved executor we render a friendly
 * "no access" panel rather than a route 403, because the navigation entry
 * on home is itself gated.
 */
export function ExecutorCabinetPage() {
  const router = useRouter()
  const { me, isAuthenticated } = useSession()
  const orders = useQuery(
    api.orders.assignedToMe,
    isAuthenticated && me?.executor?.status === 'approved' ? {} : 'skip',
  )
  const categories = useQuery(api.categories.listActive, isAuthenticated ? {} : 'skip')

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c._id, c])),
    [categories],
  )
  const { active, closed } = useMemo(() => split(orders ?? []), [orders])

  if (me?.executor?.status !== 'approved') {
    return (
      <TmaScreen title="Кабинет эксперта">
        <div className="flex flex-col items-center gap-3 px-6 pt-16 text-center">
          <Briefcase className="text-hint size-10" strokeWidth={1.6} />
          <p className="text-foreground text-base font-bold">Доступ только для экспертов</p>
          <p className="text-text-soft text-sm">
            Заполните анкету и дождитесь одобрения, чтобы видеть назначенные заявки.
          </p>
        </div>
      </TmaScreen>
    )
  }

  const balance = me.executor.balance

  return (
    <TmaScreen title="Кабинет эксперта">
      <div className="flex flex-col gap-5 pt-3 pb-2">
        <BalanceCard balance={balance} />

        {orders === undefined ? (
          <div className="flex flex-col gap-2 px-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-secondary h-16 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <Empty />
        ) : (
          <>
            {active.length > 0 && (
              <section>
                <Eyebrow>В работе · {active.length}</Eyebrow>
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
                <Eyebrow>Завершённые · {closed.length}</Eyebrow>
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
          </>
        )}
      </div>
    </TmaScreen>
  )
}

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

function Empty() {
  return (
    <div className="flex flex-col items-center gap-2 px-6 pt-10 text-center">
      <p className="text-foreground text-base font-bold">Назначенных заявок пока нет</p>
      <p className="text-text-soft text-sm">
        Как только администратор назначит вам заказ, он появится здесь.
      </p>
    </div>
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
