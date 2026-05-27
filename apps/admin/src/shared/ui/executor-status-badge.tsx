import type { ExecutorStatus } from '@tax-assistant/validators'
import { cn } from '@tax-assistant/ui'

const LABEL: Record<ExecutorStatus, string> = {
  pending: 'На рассмотрении',
  approved: 'Одобрен',
  rejected: 'Отклонён',
}

const PALETTE: Record<ExecutorStatus, string> = {
  pending: 'bg-status-pay-bg text-status-pay',
  approved: 'bg-status-done-bg text-status-done',
  rejected: 'bg-status-fail-bg text-status-fail',
}

export function ExecutorStatusBadge({ status }: { status: ExecutorStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        PALETTE[status],
      )}
    >
      {LABEL[status]}
    </span>
  )
}
