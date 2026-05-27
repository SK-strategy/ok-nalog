import { ConvexError, v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { getUser, requireAdmin } from './lib/auth'

// Current session → domain user + executor summary, for role-aware UI routing.
// Identity comes from the JWT minted by better-auth's `convex` plugin and
// verified by Convex via `auth.config.ts`; `getUser` resolves that JWT subject
// to the mirrored domain `Doc<'users'>` (see `../auth.ts` triggers).
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUser(ctx)
    if (!user) return null
    const profile = await ctx.db
      .query('executorProfiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique()
    return {
      user,
      executor: profile ? { status: profile.status, balance: profile.balance } : null,
    }
  },
})

/**
 * Admin: every domain user with denormalised counts (orders + executor status).
 * The numbers are computed on read by walking the per-user indices — fine at
 * the moderation scale we expect, simpler than maintaining a counter table.
 */
export const listAllForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const users = await ctx.db.query('users').order('desc').collect()

    return Promise.all(
      users.map(async (user) => {
        const orders = await ctx.db
          .query('orders')
          .withIndex('by_customer', (q) => q.eq('customerId', user._id))
          .collect()
        const executor = await ctx.db
          .query('executorProfiles')
          .withIndex('by_user', (q) => q.eq('userId', user._id))
          .unique()
        return {
          ...user,
          orderCount: orders.length,
          completedOrderCount: orders.filter((o) => o.status === 'completed').length,
          executorStatus: executor?.status ?? null,
        }
      }),
    )
  },
})

/** Promote/demote a domain user. Refuses to demote the caller (lockout-proof). */
export const setRole = mutation({
  args: {
    userId: v.id('users'),
    role: v.union(v.literal('customer'), v.literal('executor'), v.literal('admin')),
  },
  handler: async (ctx, { userId, role }) => {
    const admin = await requireAdmin(ctx)
    if (admin._id === userId && role !== 'admin') {
      throw new ConvexError({
        code: 'SELF_DEMOTE',
        message: 'Нельзя снять с себя роль администратора',
      })
    }
    const target = await ctx.db.get(userId)
    if (!target) throw new ConvexError({ code: 'NOT_FOUND', message: 'Пользователь не найден' })
    await ctx.db.patch(userId, { role, updatedAt: Date.now() })
  },
})
