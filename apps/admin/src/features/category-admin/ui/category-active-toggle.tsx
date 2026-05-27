'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'

import { cn } from '@tax-assistant/ui'

import type { Id } from '~/shared/api'
import { api } from '~/shared/api'

interface CategoryActiveToggleProps {
  id: Id<'categories'>
  isActive: boolean
}

/** Inline-toggle pill for a category's active flag — clickable row chip. */
export function CategoryActiveToggle({ id, isActive }: CategoryActiveToggleProps) {
  const update = useMutation(api.categories.update)
  const [pending, setPending] = useState(false)
  const next = !isActive

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async (e) => {
        e.stopPropagation()
        setPending(true)
        try {
          await update({ id, isActive: next })
        } finally {
          setPending(false)
        }
      }}
      className={cn(
        `inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium
        transition-opacity`,
        isActive ? 'bg-status-done-bg text-status-done' : 'bg-muted text-muted-foreground',
        pending && 'opacity-50',
      )}
    >
      <span
        className={cn(
          'inline-block size-1.5 rounded-full',
          isActive ? 'bg-status-done' : 'bg-muted-foreground',
        )}
      />
      {isActive ? 'Активна' : 'Скрыта'}
    </button>
  )
}
