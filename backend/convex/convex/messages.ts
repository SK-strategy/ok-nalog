import { ConvexError, v } from 'convex/values'

import { canPostMessage } from '@tax-assistant/validators'

import { internalMutation, mutation, query } from './_generated/server'
import { buildPreview, counterpartyOf, enqueueNotification } from './lib/notifications'
import { loadParticipant } from './lib/orders'

// The обезличенный диалог. Identities never cross the wire: the list returns
// senderRole + a `mine` flag only. Admins can read every thread; customer and
// executor see each other strictly as "Заказчик" / "Исполнитель".

export const list = query({
  args: { orderId: v.id('orders') },
  handler: async (ctx, { orderId }) => {
    const { user, role } = await loadParticipant(ctx, orderId)
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_order', (q) => q.eq('orderId', orderId))
      .order('asc')
      .collect()
    // Staff-only lines (moderation verdicts, manual status overrides) are
    // dropped for the заказчик here, at the read boundary — they must never
    // reach the customer's client, even hidden. Everyone else (эксперт, админ)
    // reads the full thread. `audience` is absent on rows written before the
    // field existed; those are public timeline events.
    const visible =
      role === 'customer' ? messages.filter((m) => (m.audience ?? 'all') !== 'staff') : messages
    return visible.map((m) => ({
      _id: m._id,
      senderRole: m.senderRole,
      body: m.body,
      attachmentIds: m.attachmentIds,
      audience: m.audience ?? 'all',
      createdAt: m.createdAt,
      mine: m.senderId === user._id,
    }))
  },
})

export const send = mutation({
  args: {
    orderId: v.id('orders'),
    body: v.string(),
    attachmentIds: v.array(v.id('_storage')),
  },
  handler: async (ctx, { orderId, body, attachmentIds }) => {
    const { user, order, role } = await loadParticipant(ctx, orderId)
    if (role === 'admin') {
      throw new ConvexError({ code: 'FORBIDDEN', message: 'Админ не участвует в диалоге' })
    }
    // Customer can post in any non-terminal status (clarifications, extra
    // documents, follow-ups before accepting the answer). Executor can only
    // post while the chat window is open. See `canPostMessage` for the
    // exact role/status matrix.
    if (!canPostMessage(role, order.status)) {
      throw new ConvexError({ code: 'CHAT_CLOSED', message: 'Диалог по заявке закрыт' })
    }
    const messageId = await ctx.db.insert('messages', {
      orderId,
      senderRole: role, // 'customer' | 'executor'
      senderId: user._id,
      body,
      attachmentIds,
      createdAt: Date.now(),
    })

    // Ping the other side over Telegram. Enqueue-only — `enqueueNotification`
    // never throws and never calls out to the network, so a notification
    // problem can't fail (or slow down) sending a message. `counterpartyOf`
    // returns null when there's nobody to tell yet, e.g. the customer writes
    // before an expert has been assigned.
    const recipient = counterpartyOf(order, role)
    if (recipient) {
      const category = await ctx.db.get(order.categoryId)
      await enqueueNotification(ctx, {
        userId: recipient,
        orderId,
        kind: 'order_reply',
        actorRole: role,
        preview: buildPreview(body, attachmentIds.length),
        categoryTitle: category?.title,
      })
    }

    return messageId
  },
})

// ── Backfill ────────────────────────────────────────────────────────────────

// System lines written before `audience` existed default to `'all'`, which
// means the moderation notes that prompted this split are still sitting in
// live customer threads. These prefixes are exactly the bodies `postSystem`
// now writes with `'staff'` (see orders.rejectReview / submitForReview /
// adminSetStatus), so matching on them retags the existing rows without
// touching genuine timeline events.
const STAFF_BODY_PREFIXES = [
  'Диалог отправлен на доработку',
  'Диалог отправлен на проверку модератору',
  'Администратор изменил статус:',
]

/**
 * One-off: retag historical staff messages so the customer stops seeing them.
 * Idempotent — rows already carrying an explicit `audience` are left alone.
 *
 * Run once from the CLI: `npx convex run messages:backfillStaffAudience`.
 */
export const backfillStaffAudience = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query('messages').collect()
    let updated = 0
    for (const m of all) {
      if (m.senderRole !== 'system' || m.audience !== undefined) continue
      if (!STAFF_BODY_PREFIXES.some((p) => m.body.startsWith(p))) continue
      await ctx.db.patch(m._id, { audience: 'staff' })
      updated++
    }
    return { updated, scanned: all.length }
  },
})
