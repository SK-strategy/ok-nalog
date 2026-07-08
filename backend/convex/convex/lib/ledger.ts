import { executorAccrual } from '@tax-assistant/validators'

import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

/**
 * Credit the assigned executor 70% of an order's approved price on completion.
 * Writes an `accrual` ledger row and bumps the profile balance atomically
 * within the mutation transaction. No-op if the executor has no profile.
 */
export async function accrueForOrder(
  ctx: MutationCtx,
  executorUserId: Id<'users'>,
  orderId: Id<'orders'>,
  approvedPrice: number,
): Promise<void> {
  const profile = await ctx.db
    .query('executorProfiles')
    .withIndex('by_user', (q) => q.eq('userId', executorUserId))
    .unique()
  if (!profile) return

  // Idempotent: an order accrues at most once. Admin status overrides can move
  // an order in and out of `completed`, so guard against a double payout.
  const existing = await ctx.db
    .query('transactions')
    .withIndex('by_order', (q) => q.eq('orderId', orderId))
    .filter((q) => q.eq(q.field('type'), 'accrual'))
    .first()
  if (existing) return

  const amount = executorAccrual(approvedPrice)
  const now = Date.now()
  await ctx.db.insert('transactions', {
    executorProfileId: profile._id,
    orderId,
    type: 'accrual',
    amount,
    createdAt: now,
  })
  await ctx.db.patch(profile._id, { balance: profile.balance + amount, updatedAt: now })
}

/**
 * Fold a customer's 1–10 answer rating into the executor's reputation counters.
 * Bumps `ratingSum`/`ratingCount` atomically within the mutation transaction
 * (they default to 0 for profiles predating ratings). No-op if the executor
 * has no profile.
 */
export async function recordRating(
  ctx: MutationCtx,
  executorUserId: Id<'users'>,
  score: number,
): Promise<void> {
  const profile = await ctx.db
    .query('executorProfiles')
    .withIndex('by_user', (q) => q.eq('userId', executorUserId))
    .unique()
  if (!profile) return

  await ctx.db.patch(profile._id, {
    ratingSum: (profile.ratingSum ?? 0) + score,
    ratingCount: (profile.ratingCount ?? 0) + 1,
    updatedAt: Date.now(),
  })
}
