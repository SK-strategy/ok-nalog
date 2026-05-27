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
