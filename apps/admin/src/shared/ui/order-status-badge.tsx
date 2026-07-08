import type { OrderStatus } from '@tax-assistant/validators'
import { cn } from '@tax-assistant/ui'

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  submitted: 'На проверке',
  rejected: 'Отклонена',
  priced: 'Оценена',
  awaiting_payment: 'Ожидает оплаты',
  payment_expired: 'Оплата истекла',
  paid: 'Оплачена',
  assigned: 'Назначен',
  in_progress: 'В работе',
  under_review: 'Ответ на проверке',
  answered: 'Ответ готов',
  completed: 'Выполнена',
  rated: 'Оценена',
  cancelled: 'Отменена',
}

const PALETTE: Record<OrderStatus, string> = {
  submitted: 'bg-status-search-bg text-status-search',
  rejected: 'bg-status-fail-bg text-status-fail',
  priced: 'bg-status-work-bg text-status-work',
  awaiting_payment: 'bg-status-pay-bg text-status-pay',
  payment_expired: 'bg-status-fail-bg text-status-fail',
  paid: 'bg-status-work-bg text-status-work',
  assigned: 'bg-status-work-bg text-status-work',
  in_progress: 'bg-status-work-bg text-status-work',
  under_review: 'bg-status-pay-bg text-status-pay',
  answered: 'bg-status-work-bg text-status-work',
  completed: 'bg-status-done-bg text-status-done',
  rated: 'bg-status-done-bg text-status-done',
  cancelled: 'bg-status-search-bg text-status-search',
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        PALETTE[status],
      )}
    >
      {ORDER_STATUS_LABEL[status]}
    </span>
  )
}
