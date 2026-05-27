import type { OrderStatus } from './enums'

// The order lifecycle as a guarded state machine. Both Convex mutations and the
// app UIs reason about transitions through this single map — illegal jumps are
// rejected server-side in `orders.ts`.
const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  submitted: ['priced', 'rejected', 'cancelled'],
  priced: ['awaiting_payment', 'rejected', 'cancelled'],
  awaiting_payment: ['paid', 'payment_expired', 'cancelled'],
  // Admin can re-open an expired order so the customer gets another window.
  payment_expired: ['awaiting_payment', 'cancelled'],
  paid: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['answered', 'cancelled'],
  // Customer/admin can bounce an answer back for revision.
  answered: ['completed', 'in_progress'],
  completed: [],
  rejected: [],
  cancelled: [],
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to)
}

export function nextStatuses(from: OrderStatus): readonly OrderStatus[] {
  return ORDER_TRANSITIONS[from]
}

const TERMINAL: readonly OrderStatus[] = ['completed', 'rejected', 'cancelled']
export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL.includes(status)
}

/** Statuses where the anonymized customer↔executor chat is open. */
const CHAT_OPEN: readonly OrderStatus[] = ['assigned', 'in_progress', 'answered']
export function isChatOpen(status: OrderStatus): boolean {
  return CHAT_OPEN.includes(status)
}
