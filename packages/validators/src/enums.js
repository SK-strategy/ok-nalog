'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.transactionTypeSchema =
  exports.TRANSACTION_TYPES =
  exports.messageSenderRoleSchema =
  exports.MESSAGE_SENDER_ROLES =
  exports.paymentStatusSchema =
  exports.PAYMENT_STATUSES =
  exports.executorStatusSchema =
  exports.EXECUTOR_STATUSES =
  exports.orderStatusSchema =
  exports.ORDER_STATUSES =
  exports.surfaceSchema =
  exports.SURFACES =
  exports.roleSchema =
  exports.ROLES =
    void 0
var v4_1 = require('zod/v4')
// Mirror of the string-literal unions in `backend/convex/convex/schema.ts`.
// Keep both in sync — schema.ts is the persisted source of truth.
exports.ROLES = ['customer', 'executor', 'admin']
exports.roleSchema = v4_1.z.enum(exports.ROLES)
exports.SURFACES = ['tma', 'web', 'admin']
exports.surfaceSchema = v4_1.z.enum(exports.SURFACES)
exports.ORDER_STATUSES = [
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
]
exports.orderStatusSchema = v4_1.z.enum(exports.ORDER_STATUSES)
exports.EXECUTOR_STATUSES = ['pending', 'approved', 'rejected']
exports.executorStatusSchema = v4_1.z.enum(exports.EXECUTOR_STATUSES)
exports.PAYMENT_STATUSES = ['pending', 'succeeded', 'expired', 'failed']
exports.paymentStatusSchema = v4_1.z.enum(exports.PAYMENT_STATUSES)
exports.MESSAGE_SENDER_ROLES = ['customer', 'executor', 'system']
exports.messageSenderRoleSchema = v4_1.z.enum(exports.MESSAGE_SENDER_ROLES)
exports.TRANSACTION_TYPES = ['accrual', 'payout']
exports.transactionTypeSchema = v4_1.z.enum(exports.TRANSACTION_TYPES)
