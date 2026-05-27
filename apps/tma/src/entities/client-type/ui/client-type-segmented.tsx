'use client'

import type { ClientType } from '@tax-assistant/validators'
import { CLIENT_TYPE_LABEL, CLIENT_TYPES } from '@tax-assistant/validators'

import { cn } from '~/shared/lib'

/**
 * Segmented control for the customer's client classification — sits at the
 * top of the home so the category list below stays relevant to who is
 * asking (ЮЛ/ИП, ФЛ, плательщик НПД).
 */
export function ClientTypeSegmented({
  value,
  onChange,
  className,
}: {
  value: ClientType
  onChange: (next: ClientType) => void
  className?: string
}) {
  return (
    <div
      role="tablist"
      aria-label="Тип клиента"
      className={cn('bg-secondary mx-4 grid grid-cols-3 gap-1 rounded-2xl p-1', className)}
    >
      {CLIENT_TYPES.map((ct) => {
        const isActive = ct === value
        return (
          <button
            key={ct}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(ct)}
            className={cn(
              `flex h-9 items-center justify-center rounded-xl text-[13px] font-bold tracking-tight
              transition-all`,
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-text-soft active:opacity-70',
            )}
          >
            {CLIENT_TYPE_LABEL[ct].short}
          </button>
        )
      })}
    </div>
  )
}
