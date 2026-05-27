'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'

import { cn } from '@tax-assistant/ui'

import type { Id } from '~/shared/api'
import { api } from '~/shared/api'

interface RoleSelectProps {
  userId: Id<'users'>
  role: 'customer' | 'executor' | 'admin'
  /** Disable when this row is the signed-in admin (server also refuses self-demote). */
  disabled?: boolean
}

const LABEL: Record<RoleSelectProps['role'], string> = {
  customer: 'Клиент',
  executor: 'Исполнитель',
  admin: 'Админ',
}

const ROLES = ['customer', 'executor', 'admin'] as const

export function RoleSelect({ userId, role, disabled = false }: RoleSelectProps) {
  const setRole = useMutation(api.users.setRole)
  const [pending, setPending] = useState<RoleSelectProps['role'] | null>(null)
  const value = pending ?? role

  return (
    <select
      value={value}
      disabled={disabled || pending !== null}
      onChange={async (e) => {
        const next = e.target.value as RoleSelectProps['role']
        setPending(next)
        try {
          await setRole({ userId, role: next })
        } catch {
          setPending(null)
        } finally {
          setPending(null)
        }
      }}
      className={cn(
        `border-input bg-background focus-visible:ring-ring/50 h-8 rounded-md border px-2 text-sm
        focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed
        disabled:opacity-50`,
      )}
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {LABEL[r]}
        </option>
      ))}
    </select>
  )
}
