import { ConvexError } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import { mutation } from './_generated/server'
import { getUser } from './lib/auth'
import { CATEGORIES_SEED, TAGS_SEED } from './seedData'

// Idempotent seed for the catalogue. Run from the CLI:
//   `pnpm -F @tax-assistant/convex with-env convex run seed:run`
// Categories upsert by their `code`; tags upsert by `(categoryId, name)`
// since tags no longer carry a stable code. Convex `convex run` already
// requires the deployment admin key, so this mutation has no in-app auth
// check — running it is privileged at the CLI layer.

export const run = mutation({
  args: {},
  handler: async (ctx) => {
    const seededBy = (await getUser(ctx))?._id
    const now = Date.now()

    const categoryByCode = new Map<string, Id<'categories'>>()
    let categoriesCreated = 0
    let categoriesUpdated = 0

    for (const seed of CATEGORIES_SEED) {
      const existing = await ctx.db
        .query('categories')
        .withIndex('by_code', (q) => q.eq('code', seed.code))
        .unique()
      const patch = {
        code: seed.code,
        title: seed.title,
        description: seed.description,
        basePrice: seed.basePrice,
        isActive: true,
        sortOrder: seed.sortOrder,
        clientTypes: seed.clientTypes,
        updatedAt: now,
      }
      if (existing) {
        await ctx.db.patch(existing._id, patch)
        categoryByCode.set(seed.code, existing._id)
        categoriesUpdated++
      } else {
        const id = await ctx.db.insert('categories', {
          ...patch,
          createdBy: seededBy,
          createdAt: now,
        })
        categoryByCode.set(seed.code, id)
        categoriesCreated++
      }
    }

    let tagsCreated = 0
    let tagsUpdated = 0
    let tagsSkipped = 0
    // `entries()` rather than an index loop: with `noUncheckedIndexedAccess`,
    // `TAGS_SEED[i]` is `T | undefined` and needs a non-null assertion the lint
    // config forbids. Destructuring the iterator gives a properly typed element
    // and still yields the index used for `sortOrder`.
    for (const [i, tag] of TAGS_SEED.entries()) {
      const categoryId = categoryByCode.get(tag.categoryCode)
      if (!categoryId) {
        tagsSkipped++
        continue
      }
      // Dedup by name within the category — that's the only stable handle
      // left now that tags no longer have a `code`.
      const inCategory = await ctx.db
        .query('tags')
        .withIndex('by_category', (q) => q.eq('categoryId', categoryId))
        .collect()
      const existing = inCategory.find((t) => t.name === tag.name) ?? null
      const patch: Omit<Doc<'tags'>, '_id' | '_creationTime' | 'createdAt'> = {
        name: tag.name,
        categoryId,
        clientTypes: tag.clientTypes,
        sortOrder: i,
        isActive: true,
        updatedAt: now,
      }
      if (existing) {
        await ctx.db.patch(existing._id, patch)
        tagsUpdated++
      } else {
        await ctx.db.insert('tags', { ...patch, createdAt: now })
        tagsCreated++
      }
    }

    if (tagsSkipped > 0) {
      throw new ConvexError({
        code: 'BAD_SEED',
        message: `Не удалось привязать ${tagsSkipped} тег(ов) к категории — проверьте seedData.ts`,
      })
    }

    return {
      categories: { created: categoriesCreated, updated: categoriesUpdated },
      tags: { created: tagsCreated, updated: tagsUpdated },
    }
  },
})
