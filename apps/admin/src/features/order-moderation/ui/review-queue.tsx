'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'

import { Button } from '@tax-assistant/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@tax-assistant/ui/card'
import { formatKopecks, rublesToKopecks } from '@tax-assistant/validators'

import { useSession } from '~/entities/session'
import { api } from '~/shared/api'

const fieldClass =
  'border-input bg-background rounded-md border px-2 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none'

/** "АДМИН проверяет заказ" — price approval / rejection of submitted orders. */
export function ReviewQueue() {
  const { isAuthenticated } = useSession()
  const orders = useQuery(
    api.orders.listByStatus,
    isAuthenticated ? { status: 'submitted' } : 'skip',
  )
  const approve = useMutation(api.orders.approvePrice)
  const reject = useMutation(api.orders.reject)
  const [draft, setDraft] = useState<Record<string, { price: string; reason: string }>>({})

  if (!isAuthenticated) return null

  function field(id: string) {
    return draft[id] ?? { price: '', reason: '' }
  }
  function patch(id: string, next: Partial<{ price: string; reason: string }>) {
    setDraft((d) => ({ ...d, [id]: { ...field(id), ...next } }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>На проверке ({orders?.length ?? 0})</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {orders?.length === 0 && <p className="text-muted-foreground text-sm">Очередь пуста.</p>}
        {orders?.map((o) => (
          <div key={o._id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <p className="whitespace-pre-wrap">{o.description}</p>
            <p className="text-muted-foreground text-xs">
              Ориентировочно {formatKopecks(o.quotedPrice)}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={fieldClass}
                inputMode="numeric"
                placeholder="Стоимость, ₽"
                value={field(o._id).price}
                onChange={(e) => patch(o._id, { price: e.target.value })}
              />
              <Button
                size="sm"
                disabled={!Number(field(o._id).price)}
                onClick={() =>
                  void approve({
                    orderId: o._id,
                    approvedPrice: rublesToKopecks(Number(field(o._id).price)),
                  })
                }
              >
                Утвердить стоимость
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={fieldClass}
                placeholder="Причина отказа"
                value={field(o._id).reason}
                onChange={(e) => patch(o._id, { reason: e.target.value })}
              />
              <Button
                size="sm"
                variant="destructive"
                disabled={field(o._id).reason.trim().length < 3}
                onClick={() => void reject({ orderId: o._id, reason: field(o._id).reason.trim() })}
              >
                Отклонить
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
