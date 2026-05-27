import type { ClientType } from '@tax-assistant/validators'
import { cn } from '@tax-assistant/ui'
import { CLIENT_TYPE_LABEL } from '@tax-assistant/validators'

const PALETTE: Record<ClientType, string> = {
  legal_entity_ie: 'bg-status-work-bg text-status-work',
  individual: 'bg-status-done-bg text-status-done',
  npd_payer: 'bg-status-pay-bg text-status-pay',
}

interface ClientTypePillsProps {
  types: readonly ClientType[] | undefined
  /** Show "Все" placeholder when types is undefined / empty (= category has no mapping). */
  fallback?: string
  className?: string
}

/** Coloured pills showing which client types a category / tag is mapped to. */
export function ClientTypePills({ types, fallback = 'Все типы', className }: ClientTypePillsProps) {
  if (!types || types.length === 0) {
    return <span className="text-muted-foreground text-xs italic">{fallback}</span>
  }
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {types.map((t) => (
        <span
          key={t}
          className={cn(
            'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium',
            PALETTE[t],
          )}
          title={CLIENT_TYPE_LABEL[t].full}
        >
          {CLIENT_TYPE_LABEL[t].short}
        </span>
      ))}
    </div>
  )
}
