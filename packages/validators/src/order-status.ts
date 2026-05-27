import type { OrderStatus } from './enums'

// The order lifecycle as a guarded state machine. Both Convex mutations and the
// app UIs reason about transitions through this single map — illegal jumps are
// rejected server-side in `orders.ts`.
//
// An executor can self-claim any pre-completion, not-yet-assigned order via
// `orders.claim` — that's why `assigned` is reachable from every pre-claim
// status, not just `paid`. The admin pricing / payment path still works as
// before; it just isn't a precondition anymore.
const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  submitted: ['priced', 'assigned', 'rejected', 'cancelled'],
  priced: ['awaiting_payment', 'assigned', 'rejected', 'cancelled'],
  awaiting_payment: ['paid', 'assigned', 'payment_expired', 'cancelled'],
  // Admin can re-open an expired order so the customer gets another window;
  // an executor can also just pick it up directly.
  payment_expired: ['awaiting_payment', 'assigned', 'cancelled'],
  paid: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['answered', 'cancelled'],
  // Customer/admin can bounce an answer back for revision.
  answered: ['completed', 'in_progress'],
  completed: [],
  rejected: [],
  cancelled: [],
}

/** Statuses from which an unassigned order is still claimable by an executor. */
export const CLAIMABLE_STATUSES: readonly OrderStatus[] = [
  'submitted',
  'priced',
  'awaiting_payment',
  'payment_expired',
  'paid',
]

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
