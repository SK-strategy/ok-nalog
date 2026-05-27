'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'

import { Button } from '@tax-assistant/ui/button'
import { Input } from '@tax-assistant/ui/input'

import type { Id } from '~/shared/api'
import { api } from '~/shared/api'

interface ApproveActionsProps {
  profileId: Id<'executorProfiles'>
  size?: 'sm' | 'default'
  /** Hide the reason input by default; toggled when admin clicks "Отклонить". */
  compact?: boolean
}

/**
 * Approve / reject buttons + rejection reason input, reused on the executors
 * list (pending tab) and on the executor detail page.
 */
export function ApproveActions({ profileId, size = 'sm', compact = false }: ApproveActionsProps) {
  const review = useMutation(api.executors.review)
  const [reason, setReason] = useState('')
  const [showReason, setShowReason] = useState(!compact)
  const [busy, setBusy] = useState<false | 'approve' | 'reject'>(false)

  async function approve() {
    setBusy('approve')
    try {
      await review({ profileId, decision: 'approved' })
    } finally {
      setBusy(false)
    }
  }

  async function reject() {
    if (reason.trim().length < 3) {
      setShowReason(true)
      return
    }
    setBusy('reject')
    try {
      await review({ profileId, decision: 'rejected', rejectionReason: reason.trim() })
      setReason('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button size={size} disabled={busy !== false} onClick={() => void approve()}>
          {busy === 'approve' ? 'Одобряем…' : 'Одобрить'}
        </Button>
        <Button
          size={size}
          variant="destructive"
          disabled={busy !== false}
          onClick={() => void reject()}
        >
          {busy === 'reject' ? 'Отклоняем…' : 'Отклонить'}
        </Button>
      </div>
      {showReason && (
        <Input
          placeholder="Причина отказа (мин. 3 символа)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      )}
    </div>
  )
}
