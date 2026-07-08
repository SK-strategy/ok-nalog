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
  // Executor submits the whole dialog → it goes to admin review, not straight
  // to a close. The conversation itself is the deliverable.
  in_progress: ['under_review', 'cancelled'],
  // Admin gate: approve → close the order (completed) and pay the executor;
  // reject → back to the executor's desk (in_progress) to keep working.
  under_review: ['completed', 'in_progress', 'cancelled'],
  // Legacy edge, kept so the state map stays total over OrderStatus. The
  // current flow closes from `under_review`; `answered` is no longer reached.
  answered: ['completed', 'in_progress'],
  // Delivered & accepted. The customer may still leave a 1–10 rating, which
  // is the final, optional stage of the lifecycle.
  completed: ['rated'],
  rated: [],
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

// "Terminal" for chat / list-grouping purposes: the order is closed and the
// customer↔executor dialog is done. `completed` has one remaining optional
// edge (→ `rated`), but for the chat window and the active/closed split it
// counts as closed. `rated` is fully terminal.
const TERMINAL: readonly OrderStatus[] = ['completed', 'rated', 'rejected', 'cancelled']
export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL.includes(status)
}

/**
 * Statuses where the executor may still write in the anonymized dialog. The
 * executor works the conversation while `assigned` / `in_progress`; once they
 * submit it for review (`under_review`) their composer closes until an admin
 * either closes the order or bounces it back to `in_progress`.
 */
const CHAT_OPEN: readonly OrderStatus[] = ['assigned', 'in_progress']
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
