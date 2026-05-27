'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'

import { Badge } from '@tax-assistant/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@tax-assistant/ui/card'
import { formatKopecks } from '@tax-assistant/validators'

import { TmaAuthGate } from '~/features/auth'
import { CreateOrderForm } from '~/features/create-order'
import { ExecutorApplicationForm } from '~/features/executor-application'
import { ORDER_STATUS_LABEL, orderStatusVariant } from '~/entities/order'
import { useSession } from '~/entities/session'
import type { Id } from '~/shared/api'
import { api } from '~/shared/api'
import { cn } from '~/shared/lib'

import { OrderDetail } from './order-detail'

type Tab = 'orders' | 'cabinet'

const STATUS_NOTE = {
  pending: 'Анкета на рассмотрении.',
  rejected: 'Анкета отклонена. Можно подать повторно.',
} as const

function OrderRow({
  description,
  status,
  price,
  onClick,
}: {
  description: string
  status: keyof typeof ORDER_STATUS_LABEL
  price: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="hover:bg-accent/50 flex w-full items-center justify-between gap-2 rounded-lg border
        p-3 text-left text-sm"
    >
      <span className="line-clamp-1 flex-1">{description}</span>
      <span className="text-muted-foreground">{formatKopecks(price)}</span>
      <Badge variant={orderStatusVariant(status)}>{ORDER_STATUS_LABEL[status]}</Badge>
    </button>
  )
}

function OrdersTab({ onOpen }: { onOpen: (id: Id<'orders'>) => void }) {
  const { isAuthenticated } = useSession()
  const orders = useQuery(api.orders.myOrders, isAuthenticated ? {} : 'skip')
  return (
    <div className="flex flex-col gap-4">
      <CreateOrderForm />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Мои заявки</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {orders?.length === 0 && (
            <p className="text-muted-foreground text-sm">Заявок пока нет.</p>
          )}
          {orders?.map((o) => (
            <OrderRow
              key={o._id}
              description={o.description}
              status={o.status}
              price={o.approvedPrice ?? o.quotedPrice}
              onClick={() => onOpen(o._id)}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function CabinetTab({ onOpen }: { onOpen: (id: Id<'orders'>) => void }) {
  const { isAuthenticated } = useSession()
  const data = useQuery(api.executors.myProfile, isAuthenticated ? {} : 'skip')
  const assigned = useQuery(api.orders.assignedToMe, isAuthenticated ? {} : 'skip')

  if (data === undefined) return <p className="text-muted-foreground text-sm">Загрузка…</p>

  if (data?.profile.status !== 'approved') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Анкета исполнителя</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {data && (
            <p className="text-muted-foreground text-sm">
              {STATUS_NOTE[data.profile.status]}
              {data.profile.rejectionReason ? ` ${data.profile.rejectionReason}` : ''}
            </p>
          )}
          <ExecutorApplicationForm />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Баланс</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{formatKopecks(data.profile.balance)}</p>
          <p className="text-muted-foreground text-xs">
            70% от закрытых заявок. Выплата обнуляет баланс.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Назначенные заявки</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {assigned?.length === 0 && (
            <p className="text-muted-foreground text-sm">Пока нет назначенных заявок.</p>
          )}
          {assigned?.map((o) => (
            <OrderRow
              key={o._id}
              description={o.description}
              status={o.status}
              price={o.approvedPrice ?? o.quotedPrice}
              onClick={() => onOpen(o._id)}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export function TmaAppPage() {
  const [tab, setTab] = useState<Tab>('orders')
  const [openId, setOpenId] = useState<Id<'orders'> | null>(null)

  return (
    <main className="container mx-auto flex max-w-xl flex-col gap-4 py-4">
      <TmaAuthGate>
        {openId ? (
          <OrderDetail orderId={openId} onBack={() => setOpenId(null)} />
        ) : (
          <>
            <div className="bg-muted flex gap-1 rounded-lg p-1 text-sm">
              {(
                [
                  ['orders', 'Заявки'],
                  ['cabinet', 'Исполнитель'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={cn(
                    'flex-1 rounded-md px-3 py-1.5',
                    tab === key && 'bg-background shadow-sm',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === 'orders' ? (
              <OrdersTab onOpen={setOpenId} />
            ) : (
              <CabinetTab onOpen={setOpenId} />
            )}
          </>
        )}
      </TmaAuthGate>
    </main>
  )
}
