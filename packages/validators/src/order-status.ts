import type { OrderStatus } from './enums'

// The order lifecycle as a guarded state machine. Both Convex mutations and the
// app UIs reason about transitions through this single map — illegal jumps are
// rejected server-side in `orders.ts`.
//
// Executors only see an order after the customer has paid: an order moves to
// the executor pool on `paid`, and any approved expert whose анкета covers the
// заявка's category can self-claim it via `orders.claim`. Pre-payment is the
// customer ↔ admin loop; the executor side stays clean.
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

/** Statuses from which an unassigned order is claimable by an executor. */
export const CLAIMABLE_STATUSES: readonly OrderStatus[] = ['paid']

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

/**
 * Can a participant in this role post a chat message on this status?
 *  - customer: any non-terminal status — they may clarify, attach more
 *    documents, or follow up on the response even after delivery (until
 *    they accept it).
 *  - executor: only while assigned to the order (chat window).
 *  - admin: never participates in the chat — admin posts go through
 *    `postSystem` as system events.
 */
export function canPostMessage(role: 'customer' | 'executor', status: OrderStatus): boolean {
  if (role === 'customer') return !isTerminal(status)
  return isChatOpen(status)
}
