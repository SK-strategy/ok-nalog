'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'

import { Button } from '@tax-assistant/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@tax-assistant/ui/card'
import { formatKopecks } from '@tax-assistant/validators'

import { useSession } from '~/entities/session'
import type { Doc, Id } from '~/shared/api'
import { api } from '~/shared/api'

type Executor = Doc<'executorProfiles'>

const fieldClass =
  'border-input bg-background rounded-md border px-2 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none'

/**
 * Paid orders awaiting an executor → "АДМИН назначает исполнителя".
 *
 * Each row shows the order's category, short id, price and a short snippet
 * of the description so the admin can pick without opening the order. The
 * executor dropdown surfaces approved profiles, with category-fit executors
 * (those whose `categoryIds` cover the order) listed first under a separate
 * optgroup. A small fit count under the row gives quick triage.
 */
export function AssignQueue() {
  const { isAuthenticated } = useSession()
  const orders = useQuery(api.orders.listByStatus, isAuthenticated ? { status: 'paid' } : 'skip')
  const executors = useQuery(api.executors.listApproved, isAuthenticated ? {} : 'skip')
  const categories = useQuery(api.categories.listAll, isAuthenticated ? {} : 'skip')
  const assign = useMutation(api.orders.assignExecutor)
  const [pick, setPick] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({})

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c._id, c])),
    [categories],
  )

  if (!isAuthenticated) return null

  async function submit(orderId: string, executorUserId: Id<'users'>) {
    setSubmitting((s) => ({ ...s, [orderId]: true }))
    try {
      await assign({ orderId: orderId as Id<'orders'>, executorUserId })
      setPick((p) => {
        const next = { ...p }
        delete next[orderId]
        return next
      })
    } finally {
      setSubmitting((s) => ({ ...s, [orderId]: false }))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Назначение исполнителя ({orders?.length ?? 0})</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {orders?.length === 0 && <p className="text-muted-foreground">Нет оплаченных заявок.</p>}
        {orders?.map((o) => {
          const category = categoryById.get(o.categoryId)
          const { fit, rest } = splitByFit(executors ?? [], o.categoryId)
          const price = o.approvedPrice ?? o.quotedPrice
          const shortNum = o._id.slice(-4).toUpperCase()
          const selected = pick[o._id] ?? ''
          const busy = submitting[o._id]
          return (
            <div key={o._id} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-baseline justify-between gap-3">
                <div className="font-semibold">{category?.title ?? 'Категория не указана'}</div>
                <div className="text-muted-foreground text-xs tabular-nums">
                  № {shortNum} · {formatKopecks(price)}
                </div>
              </div>
              <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
                {o.description}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className={fieldClass}
                  value={selected}
                  onChange={(e) => setPick((p) => ({ ...p, [o._id]: e.target.value }))}
                  disabled={busy}
                >
                  <option value="">— исполнитель —</option>
                  {fit.length > 0 && (
                    <optgroup label={`Подходящие · ${fit.length}`}>
                      {fit.map((ex) => (
                        <option key={ex._id} value={ex.userId}>
                          {ex.fullName}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {rest.length > 0 && (
                    <optgroup label={fit.length > 0 ? 'Остальные' : 'Все эксперты'}>
                      {rest.map((ex) => (
                        <option key={ex._id} value={ex.userId}>
                          {ex.fullName}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <Button
                  size="sm"
                  disabled={!selected || busy}
                  onClick={() => void submit(o._id, selected as Id<'users'>)}
                >
                  {busy ? 'Назначаем…' : 'Назначить'}
                </Button>
                <span className="text-muted-foreground text-xs">
                  {executors === undefined
                    ? 'Загрузка экспертов…'
                    : `Подходящих: ${fit.length} из ${executors.length}`}
                </span>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function splitByFit(
  executors: Executor[],
  categoryId: Id<'categories'>,
): { fit: Executor[]; rest: Executor[] } {
  const fit: Executor[] = []
  const rest: Executor[] = []
  for (const ex of executors) {
    if (ex.categoryIds.includes(categoryId)) fit.push(ex)
    else rest.push(ex)
  }
  return { fit, rest }
}
