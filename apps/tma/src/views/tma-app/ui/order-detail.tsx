'use client'

import { useMutation, useQuery } from 'convex/react'

import { Badge } from '@tax-assistant/ui/badge'
import { Button } from '@tax-assistant/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@tax-assistant/ui/card'
import { formatKopecks, isChatOpen } from '@tax-assistant/validators'

import { OrderChat } from '~/features/order-chat'
import { ORDER_STATUS_LABEL, orderStatusVariant } from '~/entities/order'
import { useSession } from '~/entities/session'
import type { Id } from '~/shared/api'
import { api } from '~/shared/api'

export function OrderDetail({ orderId, onBack }: { orderId: Id<'orders'>; onBack: () => void }) {
  const { isAuthenticated } = useSession()
  const data = useQuery(api.orders.get, isAuthenticated ? { orderId } : 'skip')

  const cancel = useMutation(api.orders.cancel)
  const complete = useMutation(api.orders.complete)
  const requestRevision = useMutation(api.orders.requestRevision)
  const startWork = useMutation(api.orders.startWork)
  const deliverAnswer = useMutation(api.orders.deliverAnswer)

  if (!isAuthenticated) return null
  if (!data) return <p className="text-muted-foreground text-sm">Загрузка…</p>

  const { order, category, role } = data
  const args = { orderId }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="text-muted-foreground self-start text-sm">
        ← Назад
      </button>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">{category?.title ?? 'Заявка'}</CardTitle>
            <Badge variant={orderStatusVariant(order.status)}>
              {ORDER_STATUS_LABEL[order.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="whitespace-pre-wrap">{order.description}</p>
          <p className="text-muted-foreground">
            Стоимость: {formatKopecks(order.approvedPrice ?? order.quotedPrice)}
          </p>
          {order.rejectionReason && (
            <p className="text-destructive">Причина отказа: {order.rejectionReason}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {role === 'customer' &&
              ['submitted', 'priced', 'awaiting_payment', 'payment_expired'].includes(
                order.status,
              ) && (
                <Button variant="outline" size="sm" onClick={() => void cancel(args)}>
                  Отменить
                </Button>
              )}
            {role === 'customer' && order.status === 'answered' && (
              <>
                <Button size="sm" onClick={() => void complete(args)}>
                  Принять ответ
                </Button>
                <Button variant="outline" size="sm" onClick={() => void requestRevision(args)}>
                  Доработка
                </Button>
              </>
            )}
            {role === 'executor' && order.status === 'assigned' && (
              <Button size="sm" onClick={() => void startWork(args)}>
                Взять в работу
              </Button>
            )}
            {role === 'executor' && order.status === 'in_progress' && (
              <Button size="sm" onClick={() => void deliverAnswer(args)}>
                Отправить ответ
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isChatOpen(order.status) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Обезличенный диалог</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderChat orderId={orderId} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
