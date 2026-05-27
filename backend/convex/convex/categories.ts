import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { requireAdmin, requireUser } from './lib/auth'

// Categories + their base price (примерная стоимость) are admin-managed.
// Customers pick from the active list when opening an order.

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx)
    return ctx.db
      .query('categories')
      .withIndex('by_active_order', (q) => q.eq('isActive', true))
      .collect()
  },
})

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    return ctx.db.query('categories').collect()
  },
})

export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    basePrice: v.number(), // kopecks
    isActive: v.boolean(),
    sortOrder: v.number(),
  },
  handler: async (ctx, input) => {
    const admin = await requireAdmin(ctx)
    const now = Date.now()
    return ctx.db.insert('categories', {
      ...input,
      createdBy: admin._id,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('categories'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    basePrice: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, { id, title, description, basePrice, isActive, sortOrder }) => {
    await requireAdmin(ctx)
    await ctx.db.patch(id, {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(basePrice !== undefined ? { basePrice } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
      updatedAt: Date.now(),
    })
  },
})
