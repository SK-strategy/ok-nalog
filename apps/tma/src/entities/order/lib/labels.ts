import type { OrderStatus } from '@tax-assistant/validators'

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  submitted: 'На проверке',
  rejected: 'Отклонена',
  priced: 'Оценена',
  awaiting_payment: 'Ожидает оплаты',
  payment_expired: 'Оплата просрочена',
  paid: 'Оплачена',
  assigned: 'Назначен исполнитель',
  in_progress: 'В работе',
  answered: 'Ответ готов',
  completed: 'Завершена',
  cancelled: 'Отменена',
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

export function orderStatusVariant(status: OrderStatus): BadgeVariant {
  if (status === 'rejected' || status === 'payment_expired' || status === 'cancelled') {
    return 'destructive'
  }
  if (status === 'completed') return 'default'
  if (status === 'answered' || status === 'in_progress' || status === 'assigned') {
    return 'secondary'
  }
  return 'outline'
}
