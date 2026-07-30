import { v } from 'convex/values'

import type { Id } from './_generated/dataModel'
import { internalMutation, internalQuery } from './_generated/server'
import { RETRY_BASE_MS } from './lib/notifications'

// Server side of the Telegram notification outbox. These are all `internal*`:
// they're reached exclusively through the authenticated `/bot/*` HTTP actions
// in `http.ts`, never from a browser client. Enqueueing lives in
// `lib/notifications.ts`, delivery lives in `apps/bot`.

/** Stop retrying after this many failed sends — a poison row must not spin forever. */
const MAX_ATTEMPTS = 5

/** Ceiling on one worker batch, so a backlog drains in steady chunks. */
const MAX_BATCH = 25

/**
 * Claim-free read of deliverable notifications.
 *
 * There's no lease/claim step because exactly one bot process runs (Telegram
 * long-polling only permits one consumer per token anyway). Adding leasing
 * would be machinery for a concurrency case that can't occur; `nextAttemptAt`
 * already prevents a crashed batch from being retried instantly.
 */
export const pending = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const now = Date.now()
    const rows = await ctx.db
      .query('notifications')
      .withIndex('by_status', (q) => q.eq('status', 'pending').lte('nextAttemptAt', now))
      .order('asc')
      .take(Math.min(limit ?? MAX_BATCH, MAX_BATCH))

    // Explicitly typed rather than relying on evolving-array inference, so a
    // shape change here surfaces as a type error instead of silently widening
    // the contract the bot consumes.
    const out: (
      | { id: Id<'notifications'>; undeliverable: true }
      | {
          id: Id<'notifications'>
          undeliverable: false
          chatId: string
          orderId: Id<'orders'>
          kind: 'order_reply' | 'moderator_note'
          actorRole: 'customer' | 'executor' | 'moderator'
          preview: string
          categoryTitle: string | null
          attempts: number
        }
    )[] = []
    for (const row of rows) {
      const user = await ctx.db.get(row.userId)
      // The user vanished or lost their Telegram link between enqueue and now.
      // Reported back so the worker can abandon the row rather than silently
      // leaving it pending forever.
      if (!user?.telegramId || user.botBlockedAt !== undefined) {
        out.push({ id: row._id, undeliverable: true as const })
        continue
      }
      out.push({
        id: row._id,
        undeliverable: false as const,
        chatId: user.telegramId,
        orderId: row.orderId,
        kind: row.kind,
        actorRole: row.actorRole,
        preview: row.preview,
        categoryTitle: row.categoryTitle ?? null,
        attempts: row.attempts,
      })
    }
    return out
  },
})

/**
 * Apply the worker's delivery outcomes.
 *
 * Three outcomes, deliberately distinct:
 *  - `delivered` — done.
 *  - `blocked`   — the user blocked the bot or their account is gone. Permanent
 *                  for this recipient, so we also flag the USER, which stops
 *                  `enqueueNotification` from queuing anything further for them.
 *  - `failed`    — transient (429, 5xx, network). Backs off exponentially and
 *                  gives up after MAX_ATTEMPTS.
 */
export const reportResults = internalMutation({
  args: {
    results: v.array(
      v.object({
        id: v.id('notifications'),
        outcome: v.union(
          v.literal('delivered'),
          v.literal('blocked'),
          v.literal('failed'),
          v.literal('undeliverable'),
        ),
        error: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { results }) => {
    const now = Date.now()
    let delivered = 0
    let abandoned = 0

    for (const result of results) {
      const row = await ctx.db.get(result.id)
      if (row?.status !== 'pending') continue

      if (result.outcome === 'delivered') {
        await ctx.db.patch(row._id, { status: 'delivered', deliveredAt: now })
        delivered++
        continue
      }

      if (result.outcome === 'blocked') {
        await ctx.db.patch(row._id, {
          status: 'abandoned',
          lastError: result.error ?? 'blocked by user',
        })
        // Flagging the user is the part that actually saves work: without it
        // every future order event would queue another doomed send.
        const user = await ctx.db.get(row.userId)
        if (user && user.botBlockedAt === undefined) {
          await ctx.db.patch(user._id, { botBlockedAt: now, updatedAt: now })
        }
        abandoned++
        continue
      }

      if (result.outcome === 'undeliverable') {
        await ctx.db.patch(row._id, {
          status: 'abandoned',
          lastError: result.error ?? 'no telegram target',
        })
        abandoned++
        continue
      }

      const attempts = row.attempts + 1
      if (attempts >= MAX_ATTEMPTS) {
        await ctx.db.patch(row._id, { status: 'abandoned', attempts, lastError: result.error })
        abandoned++
        continue
      }
      await ctx.db.patch(row._id, {
        attempts,
        // 30s, 1m, 2m, 4m — long enough to ride out a Telegram blip without
        // making a real reply arrive uselessly late.
        nextAttemptAt: now + RETRY_BASE_MS * 2 ** (attempts - 1),
        lastError: result.error,
      })
    }
    return { delivered, abandoned }
  },
})

/**
 * `/start` in the bot. Clears a previous block — pressing start is exactly the
 * signal that the user wants messages again — and reports whether we recognise
 * this Telegram id, so the bot can tailor its greeting for someone who hasn't
 * signed in yet.
 */
export const registerChat = internalMutation({
  args: { telegramId: v.string() },
  handler: async (ctx, { telegramId }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_telegram', (q) => q.eq('telegramId', telegramId))
      .unique()
    if (!user) return { known: false, name: null }
    if (user.botBlockedAt !== undefined) {
      await ctx.db.patch(user._id, { botBlockedAt: undefined, updatedAt: Date.now() })
    }
    return { known: true, name: user.name }
  },
})

/**
 * `/stop` — user opts out without blocking the bot outright. Reuses
 * `botBlockedAt` because the effect is identical (skip at enqueue time); the
 * bot explains that /start re-enables it.
 */
export const muteChat = internalMutation({
  args: { telegramId: v.string() },
  handler: async (ctx, { telegramId }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_telegram', (q) => q.eq('telegramId', telegramId))
      .unique()
    if (!user) return { known: false }
    const now = Date.now()
    if (user.botBlockedAt === undefined) {
      await ctx.db.patch(user._id, { botBlockedAt: now, updatedAt: now })
    }
    // Drop anything already queued — honouring an opt-out means the backlog
    // doesn't get flushed at them the moment they change their mind.
    const queued = await ctx.db
      .query('notifications')
      .withIndex('by_status', (q) => q.eq('status', 'pending'))
      .collect()
    for (const row of queued) {
      if (row.userId === user._id) {
        await ctx.db.patch(row._id, { status: 'abandoned', lastError: 'muted by user' })
      }
    }
    return { known: true }
  },
})
