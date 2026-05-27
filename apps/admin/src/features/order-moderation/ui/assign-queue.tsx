'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'

import { Button } from '@tax-assistant/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@tax-assistant/ui/card'

import { useSession } from '~/entities/session'
import { api } from '~/shared/api'

/** Paid orders awaiting an executor → "АДМИН назначает исполнителя". */
export function AssignQueue() {
  const { isAuthenticated } = useSession()
  const orders = useQuery(api.orders.listByStatus, isAuthenticated ? { status: 'paid' } : 'skip')
  const executors = useQuery(api.executors.listApproved, isAuthenticated ? {} : 'skip')
  const assign = useMutation(api.orders.assignExecutor)
  const [pick, setPick] = useState<Record<string, string>>({})

  if (!isAuthenticated) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Назначение исполнителя ({orders?.length ?? 0})</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {orders?.length === 0 && <p className="text-muted-foreground">Нет оплаченных заявок.</p>}
        {orders?.map((o) => (
          <div key={o._id} className="flex flex-col gap-2 rounded-lg border p-3">
            <span className="line-clamp-2">{o.description}</span>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="border-input bg-background rounded-md border px-2 py-1 text-sm"
                value={pick[o._id] ?? ''}
                onChange={(e) => setPick((p) => ({ ...p, [o._id]: e.target.value }))}
              >
                <option value="">— исполнитель —</option>
                {executors?.map((ex) => (
                  <option key={ex._id} value={ex.userId}>
                    {ex.fullName}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={!pick[o._id]}
                onClick={() => {
                  const executorUserId = pick[o._id]
                  if (!executorUserId) return
                  void assign({
                    orderId: o._id,
                    executorUserId: executorUserId as Parameters<
                      typeof assign
                    >[0]['executorUserId'],
                  })
                }}
              >
                Назначить
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
