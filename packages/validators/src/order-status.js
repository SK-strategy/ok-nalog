'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.canTransition = canTransition
exports.nextStatuses = nextStatuses
exports.isTerminal = isTerminal
exports.isChatOpen = isChatOpen
// The order lifecycle as a guarded state machine. Both Convex mutations and the
// app UIs reason about transitions through this single map — illegal jumps are
// rejected server-side in `orders.ts`.
var ORDER_TRANSITIONS = {
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
function canTransition(from, to) {
  return ORDER_TRANSITIONS[from].includes(to)
}
function nextStatuses(from) {
  return ORDER_TRANSITIONS[from]
}
var TERMINAL = ['completed', 'rejected', 'cancelled']
function isTerminal(status) {
  return TERMINAL.includes(status)
}
/** Statuses where the anonymized customer↔executor chat is open. */
var CHAT_OPEN = ['assigned', 'in_progress', 'answered']
function isChatOpen(status) {
  return CHAT_OPEN.includes(status)
}
