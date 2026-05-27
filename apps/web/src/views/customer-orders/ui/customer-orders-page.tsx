'use client'

import Link from 'next/link'
import { useQuery } from 'convex/react'

import { Badge } from '@tax-assistant/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@tax-assistant/ui/card'
import { formatKopecks } from '@tax-assistant/validators'

import { AuthGate } from '~/features/auth'
import { CreateOrderForm } from '~/features/create-order'
import { ORDER_STATUS_LABEL, orderStatusVariant } from '~/entities/order'
import { useSession } from '~/entities/session'
import { api } from '~/shared/api'

function OrderList() {
  const { isAuthenticated } = useSession()
  const orders = useQuery(api.orders.myOrders, isAuthenticated ? {} : 'skip')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Мои заявки</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {orders?.length === 0 && <p className="text-muted-foreground text-sm">Заявок пока нет.</p>}
        {orders?.map((o) => (
          <Link
            key={o._id}
            href={`/orders/${o._id}`}
            className="hover:bg-accent/50 flex items-center justify-between rounded-lg border p-3
              text-sm"
          >
            <span className="line-clamp-1 flex-1">{o.description}</span>
            <span className="text-muted-foreground mx-3">
              {formatKopecks(o.approvedPrice ?? o.quotedPrice)}
            </span>
            <Badge variant={orderStatusVariant(o.status)}>{ORDER_STATUS_LABEL[o.status]}</Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

export function CustomerOrdersPage() {
  return (
    <main className="container mx-auto flex max-w-3xl flex-col gap-6 py-10">
      <AuthGate>
        <CreateOrderForm />
        <OrderList />
      </AuthGate>
    </main>
  )
}
