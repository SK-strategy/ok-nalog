import { z } from 'zod/v4'

// Mirror of the string-literal unions in `backend/convex/convex/schema.ts`.
// Keep both in sync — schema.ts is the persisted source of truth.

export const ROLES = ['customer', 'executor', 'admin'] as const
export const roleSchema = z.enum(ROLES)
export type Role = (typeof ROLES)[number]

export const SURFACES = ['tma', 'web', 'admin'] as const
export const surfaceSchema = z.enum(SURFACES)
export type Surface = (typeof SURFACES)[number]

export const ORDER_STATUSES = [
  'submitted',
  'rejected',
  'priced',
  'awaiting_payment',
  'payment_expired',
  'paid',
  'assigned',
  'in_progress',
  'answered',
  'completed',
  'cancelled',
] as const
export const orderStatusSchema = z.enum(ORDER_STATUSES)
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const EXECUTOR_STATUSES = ['pending', 'approved', 'rejected'] as const
export const executorStatusSchema = z.enum(EXECUTOR_STATUSES)
export type ExecutorStatus = (typeof EXECUTOR_STATUSES)[number]

export const PAYMENT_STATUSES = ['pending', 'succeeded', 'expired', 'failed'] as const
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES)
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const MESSAGE_SENDER_ROLES = ['customer', 'executor', 'system'] as const
export const messageSenderRoleSchema = z.enum(MESSAGE_SENDER_ROLES)
export type MessageSenderRole = (typeof MESSAGE_SENDER_ROLES)[number]

export const TRANSACTION_TYPES = ['accrual', 'payout'] as const
export const transactionTypeSchema = z.enum(TRANSACTION_TYPES)
export type TransactionType = (typeof TRANSACTION_TYPES)[number]

// Client classification — used to filter categories/tags on the customer
// home so the catalogue is relevant to who is asking (юр.лицо/ИП, физлицо,
// плательщик НПД). Mirrored in `categories.clientTypes` and `tags.clientTypes`.
export const CLIENT_TYPES = ['legal_entity_ie', 'individual', 'npd_payer'] as const
export const clientTypeSchema = z.enum(CLIENT_TYPES)
export type ClientType = (typeof CLIENT_TYPES)[number]

export const CLIENT_TYPE_LABEL: Record<ClientType, { full: string; short: string }> = {
  legal_entity_ie: { full: 'Юридическое лицо / ИП', short: 'ЮЛ / ИП' },
  individual: { full: 'Физическое лицо', short: 'ФЛ' },
  npd_payer: { full: 'Плательщик НПД', short: 'НПД' },
}
