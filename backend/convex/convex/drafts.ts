import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { requireUser } from './lib/auth'

// One row per user. The new-question form debounces into `upsert` so closing
// the TMA mid-question doesn't lose work; `clear` runs on successful order
// creation.

const clientTypeArg = v.union(
  v.literal('legal_entity_ie'),
  v.literal('individual'),
  v.literal('npd_payer'),
)

export const myDraft = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx)
    return ctx.db
      .query('orderDrafts')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique()
  },
})

export const upsert = mutation({
  args: {
    categoryId: v.optional(v.id('categories')),
    tagId: v.optional(v.id('tags')),
    clientType: v.optional(clientTypeArg),
    description: v.string(),
    attachmentIds: v.array(v.id('_storage')),
    linkedOrderIds: v.optional(v.array(v.id('orders'))),
  },
  handler: async (ctx, input) => {
    const user = await requireUser(ctx)
    const now = Date.now()
    const existing = await ctx.db
      .query('orderDrafts')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, { ...input, updatedAt: now })
      return existing._id
    }
    return ctx.db.insert('orderDrafts', { userId: user._id, ...input, updatedAt: now })
  },
})

export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx)
    const existing = await ctx.db
      .query('orderDrafts')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique()
    if (existing) await ctx.db.delete(existing._id)
  },
})
