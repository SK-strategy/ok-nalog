import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { requireUser } from './lib/auth'

// Attachments (jpeg / pdf / doc) live in Convex storage. Clients POST the file
// to a short-lived upload URL, then store the returned storageId on the order
// or message. Serving URLs are resolved on demand for authenticated users.

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx)
    return ctx.storage.generateUploadUrl()
  },
})

export const getUrls = query({
  args: { ids: v.array(v.id('_storage')) },
  handler: async (ctx, { ids }) => {
    await requireUser(ctx)
    return Promise.all(ids.map(async (id) => ({ id, url: await ctx.storage.getUrl(id) })))
  },
})
