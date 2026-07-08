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
  under_review: 'Проверка ответа',
  answered: 'Ответ готов',
  completed: 'Завершена',
  rated: 'Завершена',
  cancelled: 'Отменена',
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

export function orderStatusVariant(status: OrderStatus): BadgeVariant {
  if (status === 'rejected' || status === 'payment_expired' || status === 'cancelled') {
    return 'destructive'
  }
  if (status === 'completed' || status === 'rated') return 'default'
  if (
    status === 'answered' ||
    status === 'in_progress' ||
    status === 'under_review' ||
    status === 'assigned'
  ) {
    return 'secondary'
  }
  return 'outline'
}
