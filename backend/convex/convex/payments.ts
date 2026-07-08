import { ConvexError, v } from 'convex/values'

import { internalMutation, mutation } from './_generated/server'
import { loadParticipant, postSystem, transition } from './lib/orders'
import { activeProvider, providerPaymentIdFor } from './lib/payments'

// Customer-initiated payment + the provider confirmation path. The pending
// `payments` row is created up-front in `orders.approvePrice`; `checkout`
// attaches a provider + providerPaymentId and returns a hosted-checkout URL,
// and `markPaidByProvider` (driven by the webhook in http.ts) flips the order
// to `paid`. This is the automated counterpart to the admin's `orders.markPaid`.

/**
 * Begin payment for an order awaiting it. Idempotent: re-invoking reuses the
 * same providerPaymentId. Returns the URL the client should open to pay.
 *
 * For the `mock` provider (local/dev) the URL is a Convex HTTP action that
 * confirms immediately, so the customer → paid path works end-to-end without a
 * real gateway. Real providers create a hosted intent here and return its URL.
 */
export const checkout = mutation({
  args: { orderId: v.id('orders') },
  handler: async (ctx, { orderId }) => {
    const { order, role } = await loadParticipant(ctx, orderId)
    if (role !== 'customer') {
      throw new ConvexError({ code: 'FORBIDDEN', message: 'Оплачивает заказчик' })
    }
    if (order.status !== 'awaiting_payment') {
      throw new ConvexError({ code: 'BAD_STATUS', message: 'Заявка не ожидает оплаты' })
    }
    const payment = await ctx.db
      .query('payments')
      .withIndex('by_order', (q) => q.eq('orderId', orderId))
      .order('desc')
      .first()
    if (payment?.status !== 'pending') {
      throw new ConvexError({ code: 'NO_PAYMENT', message: 'Счёт не найден' })
    }

    const provider = activeProvider()
    const providerPaymentId =
      payment.providerPaymentId ?? providerPaymentIdFor(provider, orderId, payment.createdAt)
    await ctx.db.patch(payment._id, { provider, providerPaymentId })

    const siteUrl = process.env.CONVEX_SITE_URL ?? ''
    if (provider === 'mock') {
      return {
        provider,
        checkoutUrl: `${siteUrl}/payments/mock-pay?pid=${encodeURIComponent(providerPaymentId)}`,
      }
    }
    // Real PSP: call the gateway API to create a hosted payment intent for
    // `payment.amount` with `providerPaymentId` as the merchant reference, and
    // return its confirmation URL. Not wired without merchant credentials.
    throw new ConvexError({
      code: 'PROVIDER_NOT_CONFIGURED',
      message: 'Платёжный провайдер не настроен',
    })
  },
})

/**
 * Confirm a payment from the provider side (webhook or the mock endpoint).
 * Internal-only — authenticated by the webhook's signature check, not by a
 * user session. Idempotent: safe to receive the same callback twice, and a
 * no-op if the order was already moved on (e.g. admin confirmed manually).
 */
export const markPaidByProvider = internalMutation({
  args: { providerPaymentId: v.string() },
  handler: async (ctx, { providerPaymentId }) => {
    const payment = await ctx.db
      .query('payments')
      .withIndex('by_provider_payment', (q) => q.eq('providerPaymentId', providerPaymentId))
      .first()
    if (!payment) return { ok: false, reason: 'unknown_payment' as const }
    if (payment.status === 'succeeded') return { ok: true, already: true }

    const order = await ctx.db.get(payment.orderId)
    if (!order) return { ok: false, reason: 'unknown_order' as const }

    const now = Date.now()
    if (order.status === 'awaiting_payment') {
      await transition(ctx, order, 'paid', { paidAt: now })
      await postSystem(ctx, order._id, 'Оплата получена')
    }
    if (payment.status === 'pending') {
      await ctx.db.patch(payment._id, { status: 'succeeded', paidAt: now })
    }
    return { ok: true }
  },
})
