import { ConvexError, v } from 'convex/values'

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
        // Approved profiles stay live and unchanged — the edit is parked as a
        // proposed revision until an admin confirms it (executors.reviewChanges).
        // A new edit overwrites any previous pending revision and clears the
        // last rejection comment.
        await ctx.db.patch(existing._id, {
          pendingChanges: { fullName, bio, qualifications, categoryIds, submittedAt: now },
          changeRejectionReason: undefined,
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

/**
 * Current user's executor profile + recent ledger entries + lifetime stats
 * (for the cabinet).
 *
 * `profile.balance` is the *current* pay-out balance — it gets zeroed on
 * every payout, so it doesn't tell the executor how much they've earned
 * historically. `lifetimeEarned` (sum of all accrual transactions) and
 * `completedCount` (# of accruals) survive payouts and give the cabinet
 * a meaningful "you've earned X over Y заявок" stat alongside it.
 *
 * Lifetime stats walk the full transactions index — fine at our scale; if
 * it ever matters we can denormalise the counters onto the profile row.
 */
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
    const allTransactions = await ctx.db
      .query('transactions')
      .withIndex('by_executor', (q) => q.eq('executorProfileId', profile._id))
      .collect()
    let lifetimeEarned = 0
    let completedCount = 0
    for (const t of allTransactions) {
      if (t.type === 'accrual') {
        lifetimeEarned += t.amount
        completedCount += 1
      }
    }
    return { profile, transactions, lifetimeEarned, completedCount }
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

/**
 * Admin review of a proposed анкета revision from an already-approved executor
 * (see executors.apply). On approval the pending fields replace the live ones;
 * on rejection they're discarded and the admin's comment is kept for the
 * executor. Either way the profile stays `approved` — this is about the edit,
 * not the person.
 */
export const reviewChanges = mutation({
  args: {
    profileId: v.id('executorProfiles'),
    decision: v.union(v.literal('approved'), v.literal('rejected')),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, { profileId, decision, rejectionReason }) => {
    const admin = await requireAdmin(ctx)
    const profile = await ctx.db.get(profileId)
    if (!profile) throw new ConvexError({ code: 'NOT_FOUND', message: 'Анкета не найдена' })
    const pending = profile.pendingChanges
    // Idempotent: a double-click or a stale view that already got resolved
    // just no-ops rather than throwing.
    if (!pending) return
    const now = Date.now()

    if (decision === 'approved') {
      await ctx.db.patch(profileId, {
        fullName: pending.fullName,
        bio: pending.bio,
        qualifications: pending.qualifications,
        categoryIds: pending.categoryIds,
        pendingChanges: undefined,
        changeRejectionReason: undefined,
        reviewedBy: admin._id,
        reviewedAt: now,
        updatedAt: now,
      })
    } else {
      await ctx.db.patch(profileId, {
        pendingChanges: undefined,
        changeRejectionReason: rejectionReason,
        reviewedBy: admin._id,
        reviewedAt: now,
        updatedAt: now,
      })
    }
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

// ── Admin: listings + detail used by the new admin UI ───────────────────────

/**
 * All executor profiles joined with their domain user row + assignment counts.
 * Used by the admin's `/executors` page to populate a sortable table.
 */
export const adminListAll = query({
  args: {
    status: v.optional(v.union(v.literal('pending'), v.literal('approved'), v.literal('rejected'))),
  },
  handler: async (ctx, { status }) => {
    await requireAdmin(ctx)
    const profiles = status
      ? await ctx.db
          .query('executorProfiles')
          .withIndex('by_status', (q) => q.eq('status', status))
          .order('desc')
          .collect()
      : await ctx.db.query('executorProfiles').order('desc').collect()

    return Promise.all(
      profiles.map(async (profile) => {
        const user = await ctx.db.get(profile.userId)
        const assigned = await ctx.db
          .query('orders')
          .withIndex('by_executor', (q) => q.eq('assignedExecutorId', profile.userId))
          .collect()
        return {
          ...profile,
          user,
          hasPendingChanges: profile.pendingChanges !== undefined,
          assignedOrderCount: assigned.length,
          completedOrderCount: assigned.filter((o) => o.status === 'completed').length,
          activeOrderCount: assigned.filter(
            (o) => o.status === 'assigned' || o.status === 'in_progress' || o.status === 'answered',
          ).length,
        }
      }),
    )
  },
})

/** Number of profiles awaiting review — for the sidebar badge. */
export const pendingCount = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const rows = await ctx.db
      .query('executorProfiles')
      .withIndex('by_status', (q) => q.eq('status', 'pending'))
      .collect()
    return rows.length
  },
})

/**
 * Number of approved profiles with a proposed revision awaiting review — used
 * for the «С изменениями» tab badge and folded into the sidebar's total. No
 * dedicated index (revisions are rare and short-lived); a status scan is fine
 * at our scale.
 */
export const pendingChangesCount = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const approved = await ctx.db
      .query('executorProfiles')
      .withIndex('by_status', (q) => q.eq('status', 'approved'))
      .collect()
    return approved.filter((p) => p.pendingChanges !== undefined).length
  },
})

/**
 * Single executor detail: profile + user + categories they cover + recent
 * transactions + every order ever assigned to them (admin only).
 */
export const adminGet = query({
  args: { profileId: v.id('executorProfiles') },
  handler: async (ctx, { profileId }) => {
    await requireAdmin(ctx)
    const profile = await ctx.db.get(profileId)
    if (!profile) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Анкета не найдена' })
    }
    const user = await ctx.db.get(profile.userId)
    const categories = await Promise.all(profile.categoryIds.map((id) => ctx.db.get(id)))
    // Resolve the proposed revision's categories too, so the admin diff can
    // show «тематика» changes by title rather than id.
    const pendingCategories = profile.pendingChanges
      ? (await Promise.all(profile.pendingChanges.categoryIds.map((id) => ctx.db.get(id)))).filter(
          (c): c is NonNullable<typeof c> => c !== null,
        )
      : null
    const transactions = await ctx.db
      .query('transactions')
      .withIndex('by_executor', (q) => q.eq('executorProfileId', profile._id))
      .order('desc')
      .take(50)
    const orders = await ctx.db
      .query('orders')
      .withIndex('by_executor', (q) => q.eq('assignedExecutorId', profile.userId))
      .order('desc')
      .collect()
    const orderRows = await Promise.all(
      orders.map(async (o) => {
        const category = await ctx.db.get(o.categoryId)
        return { ...o, categoryTitle: category?.title ?? null }
      }),
    )
    return {
      profile,
      user,
      categories: categories.filter((c): c is NonNullable<typeof c> => c !== null),
      pendingCategories,
      transactions,
      orders: orderRows,
    }
  },
})
