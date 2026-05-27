'use client'

import { useMutation, useQuery } from 'convex/react'

import { Button } from '@tax-assistant/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@tax-assistant/ui/card'
import { formatKopecks } from '@tax-assistant/validators'

import { useSession } from '~/entities/session'
import { api } from '~/shared/api'

/** Awaiting payment + the "кто не оплатил" expired list. */
export function PaymentQueue() {
  const { isAuthenticated } = useSession()
  const awaiting = useQuery(
    api.orders.listByStatus,
    isAuthenticated ? { status: 'awaiting_payment' } : 'skip',
  )
  const expired = useQuery(api.orders.unpaid, isAuthenticated ? {} : 'skip')
  const markPaid = useMutation(api.orders.markPaid)
  const reopen = useMutation(api.orders.reopenPayment)

  if (!isAuthenticated) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Оплата</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="flex flex-col gap-2">
          <p className="font-medium">Ожидают оплаты ({awaiting?.length ?? 0})</p>
          {awaiting?.map((o) => (
            <div key={o._id} className="flex items-center justify-between rounded-lg border p-3">
              <span className="line-clamp-1 flex-1">{o.description}</span>
              <span className="text-muted-foreground mx-3">
                {formatKopecks(o.approvedPrice ?? o.quotedPrice)}
              </span>
              <Button size="sm" onClick={() => void markPaid({ orderId: o._id })}>
                Отметить оплаченной
              </Button>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-destructive font-medium">Не оплатили ({expired?.length ?? 0})</p>
          {expired?.map((o) => (
            <div key={o._id} className="flex items-center justify-between rounded-lg border p-3">
              <span className="line-clamp-1 flex-1">{o.description}</span>
              <Button size="sm" variant="outline" onClick={() => void reopen({ orderId: o._id })}>
                Открыть оплату повторно
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
