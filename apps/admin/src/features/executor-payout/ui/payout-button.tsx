'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'

import { Button } from '@tax-assistant/ui/button'

import type { Id } from '~/shared/api'
import { api } from '~/shared/api'

interface PayoutButtonProps {
  profileId: Id<'executorProfiles'>
  balance: number
  size?: 'sm' | 'default'
}

/** Zero an approved executor's balance, recording a payout transaction. */
export function PayoutButton({ profileId, balance, size = 'sm' }: PayoutButtonProps) {
  const payout = useMutation(api.executors.payout)
  const [busy, setBusy] = useState(false)
  const disabled = busy || balance <= 0
  return (
    <Button
      size={size}
      variant="outline"
      disabled={disabled}
      onClick={async () => {
        setBusy(true)
        try {
          await payout({ profileId })
        } finally {
          setBusy(false)
        }
      }}
    >
      {busy ? 'Выплачиваем…' : 'Выплатить и обнулить'}
    </Button>
  )
}
