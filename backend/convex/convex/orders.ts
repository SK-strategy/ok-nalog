import { ConvexError, v } from 'convex/values'

import {
  CLAIMABLE_STATUSES,
  isValidRating,
  orderStatusSchema,
  PAYMENT_WINDOW_MS,
} from '@tax-assistant/validators'

import type { Doc } from './_generated/dataModel'
import { internalMutation, mutation, query } from './_generated/server'
import { getUser, requireAdmin, requireExecutor, requireUser } from './lib/auth'
import { accrueForOrder, recordRating } from './lib/ledger'
import { loadParticipant, postSystem, transition } from './lib/orders'

// The order lifecycle. Every status change goes through `transition` (guarded
// by the shared state machine). Identities are stripped at the read boundary:
// customer and executor never receive each other's ids.

function anonymize(order: Doc<'orders'>, role: 'customer' | 'executor' | 'admin') {
  if (role === 'admin') return order
  const { customerId: _c, assignedExecutorId: _e, ...rest } = order
  return rest
}

// The answer artifact is held back from the customer until an admin approves
// it. Before that (`in_progress` → `under_review`) it exists on the order but
// must not cross the read boundary, or the review gate would be cosmetic.
const ANSWER_VISIBLE_TO_CUSTOMER: readonly Doc<'orders'>['status'][] = [
  'answered',
  'completed',
  'rated',
]

/** Customer view: strip counterparty ids AND the pre-approval answer draft. */
function forCustomer(order: Doc<'orders'>) {
  const base = anonymize(order, 'customer')
  if (ANSWER_VISIBLE_TO_CUSTOMER.includes(order.status)) return base
  const { answerBody: _b, answerAttachmentIds: _a, ...rest } = base
  return rest
}

// ── Customer ────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    categoryId: v.id('categories'),
    description: v.string(),
    attachmentIds: v.array(v.id('_storage')),
    tagId: v.optional(v.id('tags')),
    clientType: v.optional(
      v.union(v.literal('legal_entity_ie'), v.literal('individual'), v.literal('npd_payer')),
    ),
  },
  handler: async (ctx, { categoryId, description, attachmentIds, tagId, clientType }) => {
    const user = await requireUser(ctx)
    const category = await ctx.db.get(categoryId)
    if (!category?.isActive) {
      throw new ConvexError({ code: 'BAD_CATEGORY', message: 'Категория недоступна' })
    }
    if (tagId) {
      const tag = await ctx.db.get(tagId)
      if (!tag?.isActive || tag.categoryId !== categoryId) {
        throw new ConvexError({ code: 'BAD_TAG', message: 'Тег недоступен' })
      }
    }
    const now = Date.now()
    const orderId = await ctx.db.insert('orders', {
      customerId: user._id,
      categoryId,
      tagId,
      clientType,
      description,
      attachmentIds,
      status: 'submitted',
      quotedPrice: category.basePrice, // snapshot
      createdAt: now,
      submittedAt: now,
    })
    // Clear the customer's draft now that it's been submitted.
    const draft = await ctx.db
      .query('orderDrafts')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique()
    if (draft) await ctx.db.delete(draft._id)
    await postSystem(ctx, orderId, 'Заявка добавлена в очередь экспертов')
    return orderId
  },
})

export const myOrders = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx)
    const orders = await ctx.db
      .query('orders')
      .withIndex('by_customer', (q) => q.eq('customerId', user._id))
      .order('desc')
      .collect()
    return orders.map(forCustomer)
  },
})

/** Order detail for any participant — identity-stripped for non-admins. */
export const get = query({
  args: { orderId: v.id('orders') },
  handler: async (ctx, { orderId }) => {
    const { order, role } = await loadParticipant(ctx, orderId)
    const category = await ctx.db.get(order.categoryId)
    const tag = order.tagId ? await ctx.db.get(order.tagId) : null
    const view = role === 'customer' ? forCustomer(order) : anonymize(order, role)
    // The assigned executor's public face: nickname + reputation only — never
    // the real name or id, so it's safe to hand to the customer alongside the
    // anonymized order.
    let executor: { nickname: string | null; ratingSum: number; ratingCount: number } | null = null
    const executorUserId = order.assignedExecutorId
    if (executorUserId) {
      const profile = await ctx.db
        .query('executorProfiles')
        .withIndex('by_user', (q) => q.eq('userId', executorUserId))
        .unique()
      if (profile) {
        executor = {
          nickname: profile.nickname ?? null,
          ratingSum: profile.ratingSum ?? 0,
          ratingCount: profile.ratingCount ?? 0,
        }
      }
    }
    return { order: view, category, tag, role, executor }
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

/**
 * Admin listing of every order with denormalised category title + customer +
 * executor names so the moderation table can render without fan-out queries
 * on the client. Limited to the most recent 500 — moderation scale.
 */
export const adminListAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const orders = await ctx.db.query('orders').order('desc').take(500)
    return Promise.all(
      orders.map(async (o) => {
        const category = await ctx.db.get(o.categoryId)
        const customer = await ctx.db.get(o.customerId)
        const executor = o.assignedExecutorId ? await ctx.db.get(o.assignedExecutorId) : null
        return {
          ...o,
          categoryTitle: category?.title ?? null,
          customer: customer
            ? {
                _id: customer._id,
                name: customer.name,
                telegramUsername: customer.telegramUsername,
                image: customer.image,
              }
            : null,
          executor: executor
            ? {
                _id: executor._id,
                name: executor.name,
                telegramUsername: executor.telegramUsername,
                image: executor.image,
              }
            : null,
        }
      }),
    )
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
    //
    // The executor's handle comes along so the moderation dialog labels the
    // conversation with the same name the customer sees, rather than a
    // generic «Эксперт».
    const executorUserId = order.assignedExecutorId
    const executorProfile = executorUserId
      ? await ctx.db
          .query('executorProfiles')
          .withIndex('by_user', (q) => q.eq('userId', executorUserId))
          .unique()
      : null
    return { order, category, executorNickname: executorProfile?.nickname ?? null }
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

// Short Russian labels for the manual-override audit log. Kept local to the
// backend so the system message reads naturally; UI label maps live per app.
const STATUS_LOG_LABEL: Record<Doc<'orders'>['status'], string> = {
  submitted: 'На проверке',
  rejected: 'Отклонена',
  priced: 'Оценена',
  awaiting_payment: 'Ожидает оплаты',
  payment_expired: 'Оплата истекла',
  paid: 'Оплачена',
  assigned: 'Назначен исполнитель',
  in_progress: 'В работе',
  under_review: 'На проверке диалога',
  answered: 'Ответ готов',
  completed: 'Завершена',
  rated: 'Оценена клиентом',
  cancelled: 'Отменена',
}

/**
 * Admin manual override: force an order to any lifecycle status, bypassing the
 * forward-only state machine. This is the escape hatch for rescuing stuck
 * orders and doing rollbacks or a manual close — the guided per-status actions
 * (approvePrice, assignExecutor, approveReview, …) remain the normal path.
 *
 * Side effects are kept idempotent so stepping back and forth is safe: the
 * completion payout is guarded inside `accrueForOrder`. We stamp a milestone
 * timestamp when crossing into a stage that records one, without clobbering an
 * existing value, and every change is written to the thread as a system event.
 */
export const adminSetStatus = mutation({
  args: { orderId: v.id('orders'), status: v.string() },
  handler: async (ctx, { orderId, status }) => {
    await requireAdmin(ctx)
    const parsed = orderStatusSchema.safeParse(status)
    if (!parsed.success) {
      throw new ConvexError({ code: 'BAD_STATUS', message: 'Неизвестный статус' })
    }
    const target = parsed.data
    const order = await ctx.db.get(orderId)
    if (!order) throw new ConvexError({ code: 'NOT_FOUND', message: 'Заявка не найдена' })
    if (order.status === target) return

    const now = Date.now()
    const patch: {
      status: Doc<'orders'>['status']
      pricedAt?: number
      paidAt?: number
      assignedAt?: number
      reviewedAt?: number
      completedAt?: number
    } = { status: target }
    if (target === 'priced' && order.pricedAt === undefined) patch.pricedAt = now
    if (target === 'paid' && order.paidAt === undefined) patch.paidAt = now
    if (target === 'assigned' && order.assignedAt === undefined) patch.assignedAt = now
    if (target === 'under_review' && order.reviewedAt === undefined) patch.reviewedAt = now
    if (target === 'completed' && order.completedAt === undefined) patch.completedAt = now
    await ctx.db.patch(orderId, patch)

    if (target === 'completed' && order.assignedExecutorId && order.approvedPrice) {
      await accrueForOrder(ctx, order.assignedExecutorId, orderId, order.approvedPrice)
    }
    await postSystem(
      ctx,
      orderId,
      `Администратор изменил статус: ${STATUS_LOG_LABEL[order.status]} → ${STATUS_LOG_LABEL[target]}`,
    )
  },
})

/**
 * One-off retirement sweep for the legacy `answered` step. The flow now closes
 * straight from `under_review` (admin gate), so `answered` is no longer reached
 * — but old orders may still be parked there with no way out. This closes each
 * one (with an idempotent payout) so nothing stays stuck. Safe to re-run.
 *
 * Internal: run from the CLI once — `npx convex run orders:closeAnsweredOrders`.
 */
export const closeAnsweredOrders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const stuck = await ctx.db
      .query('orders')
      .withIndex('by_status', (q) => q.eq('status', 'answered'))
      .collect()
    const now = Date.now()
    for (const order of stuck) {
      await ctx.db.patch(order._id, {
        status: 'completed',
        completedAt: order.completedAt ?? now,
      })
      if (order.assignedExecutorId && order.approvedPrice) {
        await accrueForOrder(ctx, order.assignedExecutorId, order._id, order.approvedPrice)
      }
      await postSystem(ctx, order._id, 'Заявка закрыта — статус «Ответ готов» упразднён')
    }
    return { closed: stuck.length }
  },
})

// ── Executor ────────────────────────────────────────────────────────────────

/** Active statuses where the order is "in flight" for the executor. */
const EXECUTOR_ACTIVE_STATUSES: Doc<'orders'>['status'][] = [
  'assigned',
  'in_progress',
  'under_review',
]

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

/**
 * The executor's "выберите заявку" pool: every paid, still-unassigned order
 * whose category appears in the caller's анкета. Orders only enter the pool
 * after the customer has paid — pre-payment lives on the customer ↔ admin
 * side. Ordered oldest-first so the longest-waiting заявка is the easiest
 * to take. The caller's own orders are excluded — a person can't pick up
 * their own заявка, and surfacing it would expose both sides of the
 * anonymised chat.
 *
 * Returns an empty list when the caller isn't an approved executor (rather
 * than throwing — the cabinet shell already gates the route; this query is
 * meant to be safe to skip).
 */
export const availableForExecutor = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUser(ctx)
    if (!user) return []
    const profile = await ctx.db
      .query('executorProfiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique()
    if (profile?.status !== 'approved' || profile.categoryIds.length === 0) return []

    // `paid` orders are unassigned by definition — the state machine moves
    // an order off `paid` the instant an executor takes it.
    const categories = new Set(profile.categoryIds)
    const paid = await ctx.db
      .query('orders')
      .withIndex('by_status', (q) => q.eq('status', 'paid'))
      .collect()
    return paid
      .filter((o) => o.customerId !== user._id && categories.has(o.categoryId))
      .sort((a, b) => (a.paidAt ?? a.createdAt) - (b.paidAt ?? b.createdAt))
      .map((o) => anonymize(o, 'executor'))
  },
})

/**
 * Single-order preview for an approved executor browsing the available
 * pool. Returns the same anonymised order shape as `availableForExecutor`,
 * plus its category + tag for rich detail rendering. Returns `null` when
 * the order is no longer claimable by this caller (it's been taken,
 * cancelled, isn't in the caller's тематики, or is their own заявка) —
 * the cabinet's preview sheet subscribes to this query and flips to an
 * "уже взяли" message the moment the result goes null.
 */
export const availablePreview = query({
  args: { orderId: v.id('orders') },
  handler: async (ctx, { orderId }) => {
    const user = await getUser(ctx)
    if (!user) return null
    const profile = await ctx.db
      .query('executorProfiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique()
    if (profile?.status !== 'approved') return null

    const order = await ctx.db.get(orderId)
    if (!order) return null
    if (!CLAIMABLE_STATUSES.includes(order.status)) return null
    if (order.customerId === user._id) return null
    if (!profile.categoryIds.includes(order.categoryId)) return null

    const category = await ctx.db.get(order.categoryId)
    const tag = order.tagId ? await ctx.db.get(order.tagId) : null
    return { order: anonymize(order, 'executor'), category, tag }
  },
})

/**
 * Executor self-claim: atomically moves `paid → assigned` if the caller is
 * approved, qualified for the category, and currently has no other order
 * still in flight. Surfaces typed errors so the cabinet UI can render the
 * right hint instead of a generic toast.
 */
export const claim = mutation({
  args: { orderId: v.id('orders') },
  handler: async (ctx, { orderId }) => {
    const { user, profile } = await requireExecutor(ctx)
    const order = await ctx.db.get(orderId)
    if (!order) throw new ConvexError({ code: 'NOT_FOUND', message: 'Заявка не найдена' })

    if (!CLAIMABLE_STATUSES.includes(order.status)) {
      throw new ConvexError({
        code: 'BAD_STATUS',
        message: 'Заявку уже взяли в работу или она закрыта',
      })
    }
    if (order.customerId === user._id) {
      throw new ConvexError({
        code: 'OWN_ORDER',
        message: 'Это ваша заявка — её должен принять другой эксперт',
      })
    }
    if (!profile.categoryIds.includes(order.categoryId)) {
      throw new ConvexError({
        code: 'BAD_CATEGORY',
        message: 'Заявка не из ваших тематик — отредактируйте анкету или выберите другую',
      })
    }

    // One active order at a time — finish what you started before taking more.
    const assignedToMe = await ctx.db
      .query('orders')
      .withIndex('by_executor', (q) => q.eq('assignedExecutorId', user._id))
      .collect()
    const hasActive = assignedToMe.some((o) => EXECUTOR_ACTIVE_STATUSES.includes(o.status))
    if (hasActive) {
      throw new ConvexError({
        code: 'BUSY',
        message: 'У вас уже есть активная заявка — завершите её, прежде чем брать новую',
      })
    }

    await transition(ctx, order, 'assigned', {
      assignedExecutorId: user._id,
      assignedAt: Date.now(),
    })
    await postSystem(ctx, orderId, 'Эксперт взял заявку в работу')
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

/**
 * Executor sends the whole dialog for moderation. The conversation itself is
 * the deliverable — there is no separate answer artifact. The order enters
 * `under_review`; an admin then either closes it (orders.approveReview) or
 * bounces it back to `in_progress` (orders.rejectReview). We require at least
 * one executor reply so an empty dialog can't be submitted.
 */
export const submitForReview = mutation({
  args: { orderId: v.id('orders') },
  handler: async (ctx, { orderId }) => {
    const { order, role } = await loadParticipant(ctx, orderId)
    if (role !== 'executor') {
      throw new ConvexError({ code: 'FORBIDDEN', message: 'Только назначенный исполнитель' })
    }
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_order', (q) => q.eq('orderId', orderId))
      .collect()
    if (!messages.some((m) => m.senderRole === 'executor')) {
      throw new ConvexError({ code: 'EMPTY_DIALOG', message: 'Сначала ответьте заказчику в чате' })
    }
    await transition(ctx, order, 'under_review', { reviewedAt: Date.now() })
    await postSystem(ctx, orderId, 'Диалог отправлен на проверку модератору')
  },
})

// ── Admin: dialog review gate ─────────────────────────────────────────────────

/** Admin verifies the dialog → close the order and accrue the executor payout. */
export const approveReview = mutation({
  args: { orderId: v.id('orders') },
  handler: async (ctx, { orderId }) => {
    await requireAdmin(ctx)
    const order = await ctx.db.get(orderId)
    if (!order) throw new ConvexError({ code: 'NOT_FOUND', message: 'Заявка не найдена' })
    await transition(ctx, order, 'completed', { completedAt: Date.now() })
    if (order.assignedExecutorId && order.approvedPrice) {
      await accrueForOrder(ctx, order.assignedExecutorId, orderId, order.approvedPrice)
    }
    await postSystem(ctx, orderId, 'Диалог проверен, заявка закрыта')
  },
})

/**
 * Bounce the dialog back to the executor. The order returns to `in_progress`
 * so the executor can keep working. The admin's note is posted as a system
 * message so the executor sees what to fix.
 */
export const rejectReview = mutation({
  args: { orderId: v.id('orders'), note: v.string() },
  handler: async (ctx, { orderId, note }) => {
    await requireAdmin(ctx)
    const order = await ctx.db.get(orderId)
    if (!order) throw new ConvexError({ code: 'NOT_FOUND', message: 'Заявка не найдена' })
    await transition(ctx, order, 'in_progress')
    const trimmed = note.trim()
    await postSystem(
      ctx,
      orderId,
      trimmed ? `Диалог отправлен на доработку: ${trimmed}` : 'Диалог отправлен на доработку',
    )
  },
})

// ── Closing ─────────────────────────────────────────────────────────────────

/**
 * Customer rates the delivered answer on a 1–10 scale — the final lifecycle
 * stage (`completed → rated`). Only the заказчик may rate, once. The score is
 * aggregated into the assigned executor's reputation (see lib/ledger).
 */
export const rateOrder = mutation({
  args: { orderId: v.id('orders'), score: v.number() },
  handler: async (ctx, { orderId, score }) => {
    const { order, role } = await loadParticipant(ctx, orderId)
    if (role !== 'customer') {
      throw new ConvexError({ code: 'FORBIDDEN', message: 'Оценку ставит заказчик' })
    }
    if (!isValidRating(score)) {
      throw new ConvexError({ code: 'BAD_RATING', message: 'Оценка должна быть от 1 до 10' })
    }
    await transition(ctx, order, 'rated', { rating: score, ratedAt: Date.now() })
    if (order.assignedExecutorId) {
      await recordRating(ctx, order.assignedExecutorId, score)
    }
    await postSystem(ctx, orderId, `Заказчик оценил ответ: ${score}/5`)
  },
})
