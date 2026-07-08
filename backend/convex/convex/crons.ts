import { cronJobs } from 'convex/server'

import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import { postSystem, transition } from './lib/orders'

// "Нет оплаты 24 часа" → auto-expire (window = PAYMENT_WINDOW_MS, stamped onto
// paymentDeadlineAt when the order enters awaiting_payment). Runs every 5
// minutes; expired orders land in the admin non-payers list (orders.unpaid)
// and can be reopened.
export const sweepExpiredPayments = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const due = await ctx.db
      .query('orders')
      .withIndex('by_status_deadline', (q) =>
        q.eq('status', 'awaiting_payment').lt('paymentDeadlineAt', now),
      )
      .collect()

    for (const order of due) {
      await transition(ctx, order, 'payment_expired')
      const payment = await ctx.db
        .query('payments')
        .withIndex('by_order', (q) => q.eq('orderId', order._id))
        .order('desc')
        .first()
      if (payment?.status === 'pending') {
        await ctx.db.patch(payment._id, { status: 'expired' })
      }
      await postSystem(ctx, order._id, 'Оплата не поступила вовремя. Заявка просрочена')
    }
    return { expired: due.length }
  },
})

const crons = cronJobs()
crons.interval('expire unpaid orders', { minutes: 5 }, internal.crons.sweepExpiredPayments, {})
export default crons
