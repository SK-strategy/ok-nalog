'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'

import { Button } from '@tax-assistant/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@tax-assistant/ui/card'
import { formatKopecks } from '@tax-assistant/validators'

import { useSession } from '~/entities/session'
import { api } from '~/shared/api'

/** Approve/reject анкеты and zero balances on payout. */
export function ExecutorModeration() {
  const { isAuthenticated } = useSession()
  const pending = useQuery(
    api.executors.listForReview,
    isAuthenticated ? { status: 'pending' } : 'skip',
  )
  const approved = useQuery(
    api.executors.listForReview,
    isAuthenticated ? { status: 'approved' } : 'skip',
  )
  const review = useMutation(api.executors.review)
  const payout = useMutation(api.executors.payout)
  const [reason, setReason] = useState<Record<string, string>>({})

  if (!isAuthenticated) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Исполнители</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="flex flex-col gap-2">
          <p className="font-medium">Анкеты на рассмотрении ({pending?.length ?? 0})</p>
          {pending?.map((p) => (
            <div key={p._id} className="flex flex-col gap-2 rounded-lg border p-3">
              <p className="font-medium">{p.fullName}</p>
              <p className="text-muted-foreground text-xs whitespace-pre-wrap">
                {p.bio}
                {'\n'}
                {p.qualifications}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => void review({ profileId: p._id, decision: 'approved' })}
                >
                  Одобрить
                </Button>
                <input
                  className="border-input bg-background rounded-md border px-2 py-1"
                  placeholder="Причина отказа"
                  value={reason[p._id] ?? ''}
                  onChange={(e) => setReason((r) => ({ ...r, [p._id]: e.target.value }))}
                />
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={(reason[p._id] ?? '').trim().length < 3}
                  onClick={() =>
                    void review({
                      profileId: p._id,
                      decision: 'rejected',
                      rejectionReason: reason[p._id]?.trim(),
                    })
                  }
                >
                  Отклонить
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <p className="font-medium">Одобренные ({approved?.length ?? 0})</p>
          {approved?.map((p) => (
            <div key={p._id} className="flex items-center justify-between rounded-lg border p-3">
              <span className="flex-1">{p.fullName}</span>
              <span className="text-muted-foreground mx-3">{formatKopecks(p.balance)}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={p.balance <= 0}
                onClick={() => void payout({ profileId: p._id })}
              >
                Выплатить и обнулить
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
