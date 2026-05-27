import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

// Source of truth for the persisted shape. The same string-literal sets are
// mirrored as Zod enums in `@tax-assistant/validators` for app/UI use — keep them in
// sync (ROLES, ORDER_STATUSES, EXECUTOR_STATUSES, …). Money is integer kopecks.
//
// Identity:
//   - The better-auth Convex component owns the authentication tables
//     (`user`, `session`, `account`, …) inside its own namespace.
//   - The domain `users` table below is a mirror, kept in sync via the
//     `triggers` wiring in `auth.ts`. Every authenticated user has exactly
//     one row here. Domain tables reference it via `Id<'users'>`.
export default defineSchema({
  // ── Domain users (mirror of the better-auth identity + Telegram profile) ──
  // Created automatically on first sign-in by the user-create trigger in
  // `auth.ts`. `authUserId` joins back to the better-auth `user._id`.
  users: defineTable({
    authUserId: v.string(),
    telegramId: v.string(),
    telegramUsername: v.optional(v.string()),
    name: v.string(),
    image: v.optional(v.string()),
    role: v.union(v.literal('customer'), v.literal('executor'), v.literal('admin')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_auth_user', ['authUserId'])
    .index('by_telegram', ['telegramId']),

  // ── Catalogue (admin-managed) ─────────────────────────────────────────────
  categories: defineTable({
    title: v.string(),
    description: v.string(),
    basePrice: v.number(), // примерная стоимость, kopecks
    isActive: v.boolean(),
    sortOrder: v.number(),
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_active_order', ['isActive', 'sortOrder']),

  // ── Executors (анкета + balance) ──────────────────────────────────────────
  executorProfiles: defineTable({
    userId: v.id('users'),
    fullName: v.string(),
    bio: v.string(),
    qualifications: v.string(),
    categoryIds: v.array(v.id('categories')),
    status: v.union(v.literal('pending'), v.literal('approved'), v.literal('rejected')),
    balance: v.number(), // kopecks accrued, zeroed on payout
    reviewedBy: v.optional(v.id('users')),
    reviewedAt: v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_status', ['status']),

  // ── Orders (the order lifecycle) ──────────────────────────────────────────
  orders: defineTable({
    customerId: v.id('users'),
    categoryId: v.id('categories'),
    description: v.string(),
    attachmentIds: v.array(v.id('_storage')),
    status: v.union(
      v.literal('submitted'),
      v.literal('rejected'),
      v.literal('priced'),
      v.literal('awaiting_payment'),
      v.literal('payment_expired'),
      v.literal('paid'),
      v.literal('assigned'),
      v.literal('in_progress'),
      v.literal('answered'),
      v.literal('completed'),
      v.literal('cancelled'),
    ),
    quotedPrice: v.number(), // snapshot of category.basePrice at creation
    approvedPrice: v.optional(v.number()), // admin-утвердил
    assignedExecutorId: v.optional(v.id('users')),
    rejectionReason: v.optional(v.string()),
    paymentDeadlineAt: v.optional(v.number()), // set = now + 1h on awaiting_payment
    createdAt: v.number(),
    submittedAt: v.optional(v.number()),
    pricedAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    assignedAt: v.optional(v.number()),
    answeredAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index('by_customer', ['customerId'])
    .index('by_executor', ['assignedExecutorId'])
    .index('by_status', ['status'])
    .index('by_status_deadline', ['status', 'paymentDeadlineAt'])
    .index('by_category', ['categoryId']),

  // ── Anonymized per-order chat ─────────────────────────────────────────────
  // UI renders senderRole only — never the real identity. Admin can read all.
  messages: defineTable({
    orderId: v.id('orders'),
    senderRole: v.union(v.literal('customer'), v.literal('executor'), v.literal('system')),
    senderId: v.optional(v.id('users')), // absent for system messages
    body: v.string(),
    attachmentIds: v.array(v.id('_storage')),
    createdAt: v.number(),
  }).index('by_order', ['orderId', 'createdAt']),

  // ── Money ─────────────────────────────────────────────────────────────────
  payments: defineTable({
    orderId: v.id('orders'),
    amount: v.number(), // kopecks
    status: v.union(
      v.literal('pending'),
      v.literal('succeeded'),
      v.literal('expired'),
      v.literal('failed'),
    ),
    provider: v.string(),
    providerPaymentId: v.optional(v.string()),
    createdAt: v.number(),
    paidAt: v.optional(v.number()),
  })
    .index('by_order', ['orderId'])
    .index('by_provider_payment', ['providerPaymentId']),

  // Executor balance ledger: accrual = +70% of approvedPrice on completion,
  // payout = negative entry written when admin zeroes the balance.
  transactions: defineTable({
    executorProfileId: v.id('executorProfiles'),
    orderId: v.optional(v.id('orders')),
    type: v.union(v.literal('accrual'), v.literal('payout')),
    amount: v.number(), // kopecks (signed)
    createdBy: v.optional(v.id('users')), // admin for payout
    createdAt: v.number(),
  })
    .index('by_executor', ['executorProfileId', 'createdAt'])
    .index('by_order', ['orderId']),
})
