'use client'

import Link from 'next/link'
import { useQuery } from 'convex/react'

import { Badge } from '@tax-assistant/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@tax-assistant/ui/card'
import { formatKopecks } from '@tax-assistant/validators'

import { AuthGate } from '~/features/auth'
import { ExecutorApplicationForm } from '~/features/executor-application'
import { ORDER_STATUS_LABEL, orderStatusVariant } from '~/entities/order'
import { useSession } from '~/entities/session'
import { api } from '~/shared/api'

const STATUS_NOTE = {
  pending: 'Анкета на рассмотрении у администратора.',
  rejected: 'Анкета отклонена. Вы можете подать её повторно.',
} as const

function AssignedOrders() {
  const { isAuthenticated } = useSession()
  const orders = useQuery(api.orders.assignedToMe, isAuthenticated ? {} : 'skip')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Назначенные заявки</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {orders?.length === 0 && (
          <p className="text-muted-foreground text-sm">Пока нет назначенных заявок.</p>
        )}
        {orders?.map((o) => (
          <Link
            key={o._id}
            href={`/orders/${o._id}`}
            className="hover:bg-accent/50 flex items-center justify-between rounded-lg border p-3
              text-sm"
          >
            <span className="line-clamp-1 flex-1">{o.description}</span>
            <Badge variant={orderStatusVariant(o.status)}>{ORDER_STATUS_LABEL[o.status]}</Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

function Cabinet() {
  const { isAuthenticated } = useSession()
  const data = useQuery(api.executors.myProfile, isAuthenticated ? {} : 'skip')

  if (data === undefined) return <p className="text-muted-foreground text-sm">Загрузка…</p>

  if (data?.profile.status !== 'approved') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Анкета исполнителя</CardTitle>
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
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Баланс</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{formatKopecks(data.profile.balance)}</p>
          <p className="text-muted-foreground text-sm">
            Начисляется 70% от стоимости закрытых заявок. Выплата обнуляет баланс.
          </p>
        </CardContent>
      </Card>
      <AssignedOrders />
    </div>
  )
}

export function ExecutorCabinetPage() {
  return (
    <main className="container mx-auto flex max-w-3xl flex-col gap-6 py-10">
      <AuthGate>
        <Cabinet />
      </AuthGate>
    </main>
  )
}
