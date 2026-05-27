import { v } from 'convex/values'

import type { Doc } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { requireAdmin, requireUser } from './lib/auth'

// Categories + their base price (примерная стоимость) are admin-managed.
// Customers pick from the active list when opening an order; the home filters
// the list to the categories that contain at least one tag relevant to the
// chosen client type (legal_entity_ie / individual / npd_payer).

const clientTypeArg = v.union(
  v.literal('legal_entity_ie'),
  v.literal('individual'),
  v.literal('npd_payer'),
)

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx)
    const rows = await ctx.db
      .query('categories')
      .withIndex('by_active_order', (q) => q.eq('isActive', true))
      .collect()
    return rows.sort((a, b) => a.sortOrder - b.sortOrder)
  },
})

/**
 * Active categories that have at least one active tag for the given client
 * type. Used by the customer home page to filter the catalogue to whatever
 * the user is asking from (юр.лицо/ИП, физлицо, плательщик НПД).
 *
 * The category's own `clientTypes` (if seeded) wins; otherwise we derive
 * eligibility from the tag set so the home page works even before all
 * categories are tagged.
 */
export const listForClientType = query({
  args: { clientType: clientTypeArg },
  handler: async (ctx, { clientType }) => {
    await requireUser(ctx)
    const allActive = await ctx.db
      .query('categories')
      .withIndex('by_active_order', (q) => q.eq('isActive', true))
      .collect()

    const eligible: Doc<'categories'>[] = []
    for (const cat of allActive) {
      if (cat.clientTypes?.includes(clientType)) {
        eligible.push(cat)
        continue
      }
      const tags = await ctx.db
        .query('tags')
        .withIndex('by_active_category', (q) => q.eq('isActive', true).eq('categoryId', cat._id))
        .collect()
      if (tags.some((t) => t.clientTypes.includes(clientType))) {
        eligible.push(cat)
      }
    }
    return eligible.sort((a, b) => a.sortOrder - b.sortOrder)
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
    code: v.optional(v.string()),
    clientTypes: v.optional(v.array(clientTypeArg)),
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
    clientTypes: v.optional(v.array(clientTypeArg)),
  },
  handler: async (ctx, { id, title, description, basePrice, isActive, sortOrder, clientTypes }) => {
    await requireAdmin(ctx)
    await ctx.db.patch(id, {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(basePrice !== undefined ? { basePrice } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
      ...(clientTypes !== undefined ? { clientTypes } : {}),
      updatedAt: Date.now(),
    })
  },
})
