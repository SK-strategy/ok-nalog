import { ConvexError, v } from 'convex/values'

import { PAYMENT_WINDOW_MS } from '@tax-assistant/validators'

import type { Doc } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { requireAdmin, requireExecutor, requireUser } from './lib/auth'
import { accrueForOrder } from './lib/ledger'
import { loadParticipant, postSystem, transition } from './lib/orders'

// The order lifecycle. Every status change goes through `transition` (guarded
// by the shared state machine). Identities are stripped at the read boundary:
// customer and executor never receive each other's ids.

function anonymize(order: Doc<'orders'>, role: 'customer' | 'executor' | 'admin') {
  if (role === 'admin') return order
  const { customerId: _c, assignedExecutorId: _e, ...rest } = order
  return rest
}

// ── Customer ────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    categoryId: v.id('categories'),
    description: v.string(),
    attachmentIds: v.array(v.id('_storage')),
  },
  handler: async (ctx, { categoryId, description, attachmentIds }) => {
    const user = await requireUser(ctx)
    const category = await ctx.db.get(categoryId)
    if (!category?.isActive) {
      throw new ConvexError({ code: 'BAD_CATEGORY', message: 'Категория недоступна' })
    }
    const now = Date.now()
    const orderId = await ctx.db.insert('orders', {
      customerId: user._id,
      categoryId,
      description,
      attachmentIds,
      status: 'submitted',
      quotedPrice: category.basePrice, // snapshot
      createdAt: now,
      submittedAt: now,
    })
    await postSystem(ctx, orderId, 'Заявка отправлена на проверку администратору')
    return orderId
  },
})

export const myOrders = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx)
    return ctx.db
      .query('orders')
      .withIndex('by_customer', (q) => q.eq('customerId', user._id))
      .order('desc')
      .collect()
  },
})

/** Order detail for any participant — identity-stripped for non-admins. */
export const get = query({
  args: { orderId: v.id('orders') },
  handler: async (ctx, { orderId }) => {
    const { order, role } = await loadParticipant(ctx, orderId)
    const category = await ctx.db.get(order.categoryId)
    return { order: anonymize(order, role), category, role }
  },
})

export const cancel = mutation({
  args: { orderId: v.id('orders') },
  handler: async (ctx, { orderId }) => {
    const { order, role } = await loadParticipant(ctx, orderId)
    // Customers may only bail out before work has been paid for.
    const customerCancelable = ['submitted', 'priced', 'awaiting_payment', 'payment_expired']
    if (role === 'customer' && !customerCancelable.includes(order.status)) {
      throw new ConvexError({ code: 'FORBIDDEN', message: 'Заявку уже нельзя отменить' })
    }
    if (role === 'executor') {
      throw new ConvexError({ code: 'FORBIDDEN', message: 'Исполнитель не может отменить заявку' })
    }
    await transition(ctx, order, 'cancelled')
    await postSystem(ctx, orderId, 'Заявка отменена')
  },
})

// ── Admin: review, pricing, payment, assignment ─────────────────────────────

export const listByStatus = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, { status }) => {
    await requireAdmin(ctx)
    const q = ctx.db.query('orders')
    if (status) {
      return q
        .withIndex('by_status', (ix) => ix.eq('status', status as Doc<'orders'>['status']))
        .order('desc')
        .collect()
    }
    return q.order('desc').take(200)
  },
})

/** "Сформировать список из тех, кто не оплатил" — expired-payment orders. */
export const unpaid = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    return ctx.db
      .query('orders')
      .withIndex('by_status', (q) => q.eq('status', 'payment_expired'))
      .order('desc')
      .collect()
  },
})

export const adminGet = query({
  args: { orderId: v.id('orders') },
  handler: async (ctx, { orderId }) => {
    await requireAdmin(ctx)
    const order = await ctx.db.get(orderId)
    if (!order) throw new ConvexError({ code: 'NOT_FOUND', message: 'Заявка не найдена' })
    const category = await ctx.db.get(order.categoryId)
    // User identity lookups go through better-auth's component; admin UI
    // typically only needs ids/usernames which can be fetched via
    // authComponent.getAnyUserById on demand.
    return { order, category }
  },
})

/** Approve cost and immediately open the order for payment (1h window). */
export const approvePrice = mutation({
  args: { orderId: v.id('orders'), approvedPrice: v.number() },
  handler: async (ctx, { orderId, approvedPrice }) => {
    await requireAdmin(ctx)
    const order = await ctx.db.get(orderId)
    if (!order) throw new ConvexError({ code: 'NOT_FOUND', message: 'Заявка не найдена' })
    const now = Date.now()

    await transition(ctx, order, 'priced', { approvedPrice, pricedAt: now })
    const priced = await ctx.db.get(orderId)
    if (!priced) throw new ConvexError({ code: 'NOT_FOUND', message: 'Заявка не найдена' })
    await transition(ctx, priced, 'awaiting_payment', {
      paymentDeadlineAt: now + PAYMENT_WINDOW_MS,
    })
    await ctx.db.insert('payments', {
      orderId,
      amount: approvedPrice,
      status: 'pending',
      provider: 'manual', // TODO: wire Telegram Payments / ЮKassa webhook
      createdAt: now,
    })
    await postSystem(ctx, orderId, 'Стоимость утверждена. Заявка ожидает оплаты')
  },
})

export const reject = mutation({
  args: { orderId: v.id('orders'), reason: v.string() },
  handler: async (ctx, { orderId, reason }) => {
    await requireAdmin(ctx)
    const order = await ctx.db.get(orderId)
    if (!order) throw new ConvexError({ code: 'NOT_FOUND', message: 'Заявка не найдена' })
    await transition(ctx, order, 'rejected', { rejectionReason: reason })
    await postSystem(ctx, orderId, `Заявка отклонена: ${reason}`)
  },
})

/** Confirm payment. Placeholder for the provider webhook (httpAction). */
export const markPaid = mutation({
  args: { orderId: v.id('orders') },
  handler: async (ctx, { orderId }) => {
    await requireAdmin(ctx)
    const order = await ctx.db.get(orderId)
    if (!order) throw new ConvexError({ code: 'NOT_FOUND', message: 'Заявка не найдена' })
    const now = Date.now()
    await transition(ctx, order, 'paid', { paidAt: now })
    const payment = await ctx.db
      .query('payments')
      .withIndex('by_order', (q) => q.eq('orderId', orderId))
      .order('desc')
      .first()
    if (payment?.status === 'pending') {
      await ctx.db.patch(payment._id, { status: 'succeeded', paidAt: now })
    }
    await postSystem(ctx, orderId, 'Оплата получена')
  },
})

export const reopenPayment = mutation({
  args: { orderId: v.id('orders') },
  handler: async (ctx, { orderId }) => {
    await requireAdmin(ctx)
    const order = await ctx.db.get(orderId)
    if (!order) throw new ConvexError({ code: 'NOT_FOUND', message: 'Заявка не найдена' })
    await transition(ctx, order, 'awaiting_payment', {
      paymentDeadlineAt: Date.now() + PAYMENT_WINDOW_MS,
    })
    await postSystem(ctx, orderId, 'Оплата открыта повторно')
  },
})

export const assignExecutor = mutation({
  args: { orderId: v.id('orders'), executorUserId: v.id('users') },
  handler: async (ctx, { orderId, executorUserId }) => {
    await requireAdmin(ctx)
    const order = await ctx.db.get(orderId)
    if (!order) throw new ConvexError({ code: 'NOT_FOUND', message: 'Заявка не найдена' })
    const profile = await ctx.db
      .query('executorProfiles')
      .withIndex('by_user', (q) => q.eq('userId', executorUserId))
      .unique()
    if (profile?.status !== 'approved') {
      throw new ConvexError({ code: 'BAD_EXECUTOR', message: 'Исполнитель не одобрен' })
    }
    await transition(ctx, order, 'assigned', {
      assignedExecutorId: executorUserId,
      assignedAt: Date.now(),
    })
    await postSystem(ctx, orderId, 'Назначен исполнитель. Ваша задача в работе')
  },
})

// ── Executor ────────────────────────────────────────────────────────────────

export const assignedToMe = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireExecutor(ctx)
    const orders = await ctx.db
      .query('orders')
      .withIndex('by_executor', (q) => q.eq('assignedExecutorId', user._id))
      .order('desc')
      .collect()
    return orders.map((o) => anonymize(o, 'executor'))
  },
})

export const startWork = mutation({
  args: { orderId: v.id('orders') },
  handler: async (ctx, { orderId }) => {
    const { order, role } = await loadParticipant(ctx, orderId)
    if (role !== 'executor') {
      throw new ConvexError({ code: 'FORBIDDEN', message: 'Только назначенный исполнитель' })
    }
    await transition(ctx, order, 'in_progress')
    await postSystem(ctx, orderId, 'Исполнитель приступил к работе')
  },
})

export const deliverAnswer = mutation({
  args: { orderId: v.id('orders') },
  handler: async (ctx, { orderId }) => {
    const { order, role } = await loadParticipant(ctx, orderId)
    if (role !== 'executor') {
      throw new ConvexError({ code: 'FORBIDDEN', message: 'Только назначенный исполнитель' })
    }
    await transition(ctx, order, 'answered', { answeredAt: Date.now() })
    await postSystem(ctx, orderId, 'Ваш ответ готов!!!')
  },
})

// ── Closing ─────────────────────────────────────────────────────────────────

export const complete = mutation({
  args: { orderId: v.id('orders') },
  handler: async (ctx, { orderId }) => {
    const { order, role } = await loadParticipant(ctx, orderId)
    if (role === 'executor') {
      throw new ConvexError({ code: 'FORBIDDEN', message: 'Подтверждает заказчик или админ' })
    }
    await transition(ctx, order, 'completed', { completedAt: Date.now() })
    if (order.assignedExecutorId && order.approvedPrice) {
      await accrueForOrder(ctx, order.assignedExecutorId, orderId, order.approvedPrice)
    }
    await postSystem(ctx, orderId, 'Заявка успешно закрыта')
  },
})

export const requestRevision = mutation({
  args: { orderId: v.id('orders') },
  handler: async (ctx, { orderId }) => {
    const { order, role } = await loadParticipant(ctx, orderId)
    if (role === 'executor') {
      throw new ConvexError({ code: 'FORBIDDEN', message: 'Доработку запрашивает заказчик' })
    }
    await transition(ctx, order, 'in_progress')
    await postSystem(ctx, orderId, 'Запрошена доработка ответа')
  },
})
