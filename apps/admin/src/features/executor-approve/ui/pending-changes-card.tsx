'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { Check, PencilLine, X } from 'lucide-react'

import { Button } from '@tax-assistant/ui/button'
import { Input } from '@tax-assistant/ui/input'

import type { Id } from '~/shared/api'
import { api } from '~/shared/api'
import { formatDateTime } from '~/shared/lib'

interface FieldSnapshot {
  fullName: string
  bio: string
  qualifications: string
  categoryTitles: string[]
}

interface PendingChangesCardProps {
  profileId: Id<'executorProfiles'>
  current: FieldSnapshot
  proposed: FieldSnapshot
  submittedAt: number
}

interface FieldDiff {
  label: string
  before: string
  after: string
}

/**
 * Review surface for a proposed анкета revision from an already-approved
 * executor. Shows only the fields that actually changed as a before → after
 * diff, with confirm / reject (reject requires a comment). On confirm the
 * revision replaces the live анкета; on reject it's discarded.
 */
export function PendingChangesCard({
  profileId,
  current,
  proposed,
  submittedAt,
}: PendingChangesCardProps) {
  const review = useMutation(api.executors.reviewChanges)
  const [reason, setReason] = useState('')
  const [showReason, setShowReason] = useState(false)
  const [busy, setBusy] = useState<false | 'approve' | 'reject'>(false)

  const diffs = buildDiffs(current, proposed)

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
    <section className="border-status-pay/30 bg-status-pay-bg/40 flex flex-col gap-4 border-b p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-status-pay flex items-center gap-2 text-sm font-semibold">
          <PencilLine className="size-4" />
          Изменения анкеты на проверке
        </h2>
        <span className="text-muted-foreground text-xs">
          Отправлено {formatDateTime(submittedAt)}
        </span>
      </div>

      <p className="text-muted-foreground text-xs">
        Исполнитель остаётся одобренным, клиенты видят прежнюю анкету. Подтвердите, чтобы обновить
        её, или отклоните с комментарием.
      </p>

      <div className="flex flex-col gap-px">
        {diffs.length === 0 ? (
          <p className="text-muted-foreground text-sm">Изменений в полях нет.</p>
        ) : (
          diffs.map((d) => <DiffRow key={d.label} diff={d} />)
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={busy !== false} onClick={() => void approve()}>
            <Check className="size-4" />
            {busy === 'approve' ? 'Подтверждаем…' : 'Подтвердить изменения'}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={busy !== false}
            onClick={() => void reject()}
          >
            <X className="size-4" />
            {busy === 'reject' ? 'Отклоняем…' : 'Отклонить'}
          </Button>
        </div>
        {showReason && (
          <Input
            placeholder="Причина отклонения (мин. 3 символа)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
      </div>
    </section>
  )
}

function DiffRow({ diff }: { diff: FieldDiff }) {
  return (
    <div className="bg-background flex flex-col gap-1.5 border-b px-4 py-3 last:border-b-0">
      <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
        {diff.label}
      </span>
      <div className="grid gap-2 sm:grid-cols-2">
        <p className="text-muted-foreground text-sm whitespace-pre-wrap line-through decoration-1">
          {diff.before || '—'}
        </p>
        <p
          className="text-foreground border-status-done/40 border-l-2 pl-2 text-sm
            whitespace-pre-wrap"
        >
          {diff.after || '—'}
        </p>
      </div>
    </div>
  )
}

function buildDiffs(current: FieldSnapshot, proposed: FieldSnapshot): FieldDiff[] {
  const diffs: FieldDiff[] = []
  if (current.fullName !== proposed.fullName) {
    diffs.push({ label: 'Имя', before: current.fullName, after: proposed.fullName })
  }
  if (current.bio !== proposed.bio) {
    diffs.push({ label: 'О себе', before: current.bio, after: proposed.bio })
  }
  if (current.qualifications !== proposed.qualifications) {
    diffs.push({
      label: 'Квалификация',
      before: current.qualifications,
      after: proposed.qualifications,
    })
  }
  const beforeCats = current.categoryTitles.join(' · ')
  const afterCats = proposed.categoryTitles.join(' · ')
  if (beforeCats !== afterCats) {
    diffs.push({ label: 'Тематика', before: beforeCats, after: afterCats })
  }
  return diffs
}
