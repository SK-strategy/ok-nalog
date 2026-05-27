import { ConvexError, v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { requireAdmin, requireUser } from './lib/auth'

// Tags are the specific topics inside a category (e.g. "Камеральная налоговая
// проверка" inside "Налоговые проверки"). Customers pick a tag in the new-
// question form so the admin/executor get a precise topic + matching
// specialistCode for routing.

const clientTypeArg = v.union(
  v.literal('legal_entity_ie'),
  v.literal('individual'),
  v.literal('npd_payer'),
)

export const listByCategoryAndType = query({
  args: {
    categoryId: v.id('categories'),
    clientType: v.optional(clientTypeArg),
  },
  handler: async (ctx, { categoryId, clientType }) => {
    await requireUser(ctx)
    const tags = await ctx.db
      .query('tags')
      .withIndex('by_active_category', (q) => q.eq('isActive', true).eq('categoryId', categoryId))
      .collect()
    const filtered = clientType ? tags.filter((t) => t.clientTypes.includes(clientType)) : tags
    return filtered.sort((a, b) => a.sortOrder - b.sortOrder)
  },
})

/** Flat searchable list — used by the form when no category is preselected. */
export const listForClientType = query({
  args: { clientType: clientTypeArg },
  handler: async (ctx, { clientType }) => {
    await requireUser(ctx)
    const tags = await ctx.db.query('tags').collect()
    const filtered = tags.filter((t) => t.isActive && t.clientTypes.includes(clientType))
    return filtered.sort((a, b) => a.sortOrder - b.sortOrder)
  },
})

export const get = query({
  args: { id: v.id('tags') },
  handler: async (ctx, { id }) => {
    await requireUser(ctx)
    return ctx.db.get(id)
  },
})

export const create = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    specialistCode: v.optional(v.string()),
    categoryId: v.id('categories'),
    clientTypes: v.array(clientTypeArg),
    sortOrder: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx, input) => {
    await requireAdmin(ctx)
    const existing = await ctx.db
      .query('tags')
      .withIndex('by_code', (q) => q.eq('code', input.code))
      .unique()
    if (existing) {
      throw new ConvexError({ code: 'DUPLICATE', message: `Тег ${input.code} уже существует` })
    }
    const now = Date.now()
    return ctx.db.insert('tags', { ...input, createdAt: now, updatedAt: now })
  },
})
