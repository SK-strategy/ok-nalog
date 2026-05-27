'use client'

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

import { cn } from '@tax-assistant/ui'

import type { SortDir } from '~/shared/lib'

interface SortHeaderProps {
  label: string
  active: boolean
  dir: SortDir
  onToggle: () => void
  align?: 'left' | 'right'
}

/** Clickable th content for table column sorting — pairs with `useSort`. */
export function SortHeader({ label, active, dir, onToggle, align = 'left' }: SortHeaderProps) {
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'hover:text-foreground flex items-center gap-1.5 transition-colors',
        active && 'text-foreground',
        align === 'right' && 'ml-auto flex-row-reverse',
      )}
    >
      <span>{label}</span>
      <Icon className={cn('size-3.5 opacity-60', active && 'opacity-100')} aria-hidden />
    </button>
  )
}
