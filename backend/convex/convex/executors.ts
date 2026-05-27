import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { requireAdmin, requireUser } from './lib/auth'

// Executor анкета lifecycle: a user applies → admin approves/rejects →
// approved users get role 'executor' (derived from profile.status) and can be
// assigned orders. Balance accrues on order completion (see lib/ledger) and is
// zeroed on payout.

export const apply = mutation({
  args: {
    fullName: v.string(),
    bio: v.string(),
    qualifications: v.string(),
    categoryIds: v.array(v.id('categories')),
  },
  handler: async (ctx, { fullName, bio, qualifications, categoryIds }) => {
    const user = await requireUser(ctx)
    const existing = await ctx.db
      .query('executorProfiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique()
    const now = Date.now()

    if (existing) {
      if (existing.status === 'approved') {
        // Approved profiles edit their details but stay approved.
        await ctx.db.patch(existing._id, {
          fullName,
          bio,
          qualifications,
          categoryIds,
          updatedAt: now,
        })
      } else {
        // pending or rejected → (re)submit for review.
        await ctx.db.patch(existing._id, {
          fullName,
          bio,
          qualifications,
          categoryIds,
          status: 'pending',
          rejectionReason: undefined,
          updatedAt: now,
        })
      }
      return existing._id
    }

    return ctx.db.insert('executorProfiles', {
      userId: user._id,
      fullName,
      bio,
      qualifications,
      categoryIds,
      status: 'pending',
      balance: 0,
      createdAt: now,
      updatedAt: now,
    })
  },
})

/** Current user's executor profile + recent ledger entries (for the cabinet). */
export const myProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx)
    const profile = await ctx.db
      .query('executorProfiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique()
    if (!profile) return null
    const transactions = await ctx.db
      .query('transactions')
      .withIndex('by_executor', (q) => q.eq('executorProfileId', profile._id))
      .order('desc')
      .take(50)
    return { profile, transactions }
  },
})

export const listForReview = query({
  args: {
    status: v.optional(v.union(v.literal('pending'), v.literal('approved'), v.literal('rejected'))),
  },
  handler: async (ctx, { status }) => {
    await requireAdmin(ctx)
    return ctx.db
      .query('executorProfiles')
      .withIndex('by_status', (q) => q.eq('status', status ?? 'pending'))
      .order('desc')
      .collect()
  },
})

export const review = mutation({
  args: {
    profileId: v.id('executorProfiles'),
    decision: v.union(v.literal('approved'), v.literal('rejected')),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, { profileId, decision, rejectionReason }) => {
    const admin = await requireAdmin(ctx)
    const profile = await ctx.db.get(profileId)
    if (!profile) throw new Error('profile not found')
    const now = Date.now()

    await ctx.db.patch(profileId, {
      status: decision,
      reviewedBy: admin._id,
      reviewedAt: now,
      rejectionReason: decision === 'rejected' ? rejectionReason : undefined,
      updatedAt: now,
    })

    // The 'executor' role is derived from profile.status === 'approved' via
    // requireExecutor() — no longer stored on the user record.
  },
})

/** Approved executors, for the admin assignment picker. */
export const listApproved = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    return ctx.db
      .query('executorProfiles')
      .withIndex('by_status', (q) => q.eq('status', 'approved'))
      .collect()
  },
})

/** Zero an executor's balance on payout, recording a signed ledger entry. */
export const payout = mutation({
  args: { profileId: v.id('executorProfiles') },
  handler: async (ctx, { profileId }) => {
    const admin = await requireAdmin(ctx)
    const profile = await ctx.db.get(profileId)
    if (!profile) throw new Error('profile not found')
    if (profile.balance <= 0) return
    const now = Date.now()
    await ctx.db.insert('transactions', {
      executorProfileId: profileId,
      type: 'payout',
      amount: -profile.balance,
      createdBy: admin._id,
      createdAt: now,
    })
    await ctx.db.patch(profileId, { balance: 0, updatedAt: now })
  },
})
