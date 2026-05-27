import { ConvexError, v } from 'convex/values'

import { isChatOpen } from '@tax-assistant/validators'

import { mutation, query } from './_generated/server'
import { loadParticipant } from './lib/orders'

// The обезличенный диалог. Identities never cross the wire: the list returns
// senderRole + a `mine` flag only. Admins can read every thread; customer and
// executor see each other strictly as "Заказчик" / "Исполнитель".

export const list = query({
  args: { orderId: v.id('orders') },
  handler: async (ctx, { orderId }) => {
    const { user } = await loadParticipant(ctx, orderId)
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_order', (q) => q.eq('orderId', orderId))
      .order('asc')
      .collect()
    return messages.map((m) => ({
      _id: m._id,
      senderRole: m.senderRole,
      body: m.body,
      attachmentIds: m.attachmentIds,
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
    if (!isChatOpen(order.status)) {
      throw new ConvexError({ code: 'CHAT_CLOSED', message: 'Диалог по заявке закрыт' })
    }
    return ctx.db.insert('messages', {
      orderId,
      senderRole: role, // 'customer' | 'executor'
      senderId: user._id,
      body,
      attachmentIds,
      createdAt: Date.now(),
    })
  },
})
