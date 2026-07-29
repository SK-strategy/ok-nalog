'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { AlertTriangle } from 'lucide-react'

import { Button } from '@tax-assistant/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@tax-assistant/ui/dialog'
import { formatKopecks } from '@tax-assistant/validators'

import type { Id } from '~/shared/api'
import { api } from '~/shared/api'

interface PayoutButtonProps {
  profileId: Id<'executorProfiles'>
  balance: number
  /** Shown in the confirmation so the admin can check who they're paying. */
  executorName?: string
  size?: 'sm' | 'default'
}

/**
 * Zero an approved executor's balance, recording a payout transaction.
 *
 * Gated behind an explicit confirmation: `executors.payout` writes a payout
 * transaction and sets `balance = 0` with no undo, and the button sits in the
 * page header right next to navigation — a stray click used to wipe an
 * executor's accrued earnings outright. The dialog restates the exact sum and
 * whose it is before that becomes possible.
 */
export function PayoutButton({ profileId, balance, executorName, size = 'sm' }: PayoutButtonProps) {
  const payout = useMutation(api.executors.payout)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await payout({ profileId })
      setConfirming(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось провести выплату')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        size={size}
        variant="outline"
        disabled={balance <= 0}
        onClick={() => {
          setError(null)
          setConfirming(true)
        }}
      >
        Выплатить и обнулить
      </Button>

      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          // Don't let an outside click dismiss the dialog mid-mutation.
          if (!busy) setConfirming(open)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="text-destructive size-4" />
              Обнулить баланс?
            </DialogTitle>
            <DialogDescription>Действие необратимо — баланс не восстановить.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 text-sm">
            <p>
              Будет записана выплата на{' '}
              <span className="font-semibold tabular-nums">{formatKopecks(balance)}</span>
              {executorName && (
                <>
                  {' '}
                  исполнителю <span className="font-semibold">{executorName}</span>
                </>
              )}
              , а его баланс станет нулевым.
            </p>
            <p className="text-muted-foreground text-xs">
              Подтверждайте только после того, как деньги действительно отправлены.
            </p>
            {error && <p className="text-destructive text-xs">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>
              Отмена
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => void confirm()}>
              {busy ? 'Выплачиваем…' : `Выплатить ${formatKopecks(balance)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
