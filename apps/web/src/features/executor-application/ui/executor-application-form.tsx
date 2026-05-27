'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'

import { Button } from '@tax-assistant/ui/button'

import { useSession } from '~/entities/session'
import type { Id } from '~/shared/api'
import { api } from '~/shared/api'
import { cn } from '~/shared/lib'

const fieldClass =
  'border-input bg-background focus-visible:ring-ring rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none'

export function ExecutorApplicationForm({ onSubmitted }: { onSubmitted?: () => void }) {
  const { isAuthenticated } = useSession()
  const categories = useQuery(api.categories.listActive, isAuthenticated ? {} : 'skip')
  const apply = useMutation(api.executors.apply)

  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [qualifications, setQualifications] = useState('')
  const [categoryIds, setCategoryIds] = useState<Id<'categories'>[]>([])
  const [busy, setBusy] = useState(false)

  function toggle(id: Id<'categories'>) {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const canSubmit =
    isAuthenticated &&
    fullName.trim().length >= 2 &&
    bio.trim().length >= 20 &&
    qualifications.trim().length >= 10 &&
    categoryIds.length > 0 &&
    !busy

  async function submit() {
    if (!isAuthenticated) return
    setBusy(true)
    try {
      await apply({
        fullName: fullName.trim(),
        bio: bio.trim(),
        qualifications: qualifications.trim(),
        categoryIds,
      })
      onSubmitted?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        ФИО
        <input
          className={fieldClass}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        О себе
        <textarea
          className={fieldClass}
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Квалификация и опыт
        <textarea
          className={fieldClass}
          rows={3}
          value={qualifications}
          onChange={(e) => setQualifications(e.target.value)}
        />
      </label>

      <div className="flex flex-col gap-2 text-sm font-medium">
        Категории, по которым консультируете
        <div className="grid gap-2 sm:grid-cols-2">
          {categories?.map((c) => (
            <button
              key={c._id}
              type="button"
              onClick={() => toggle(c._id)}
              className={cn(
                'rounded-lg border p-2 text-left text-sm transition-colors',
                categoryIds.includes(c._id) ? 'border-primary bg-accent' : 'hover:bg-accent/50',
              )}
            >
              {c.title}
            </button>
          ))}
        </div>
      </div>

      <Button disabled={!canSubmit} onClick={() => void submit()}>
        {busy ? 'Отправка…' : 'Отправить анкету'}
      </Button>
    </div>
  )
}
