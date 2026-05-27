import type { WithoutSystemFields } from 'convex/server'
import { ConvexError } from 'convex/values'

import type { OrderStatus } from '@tax-assistant/validators'
import { canTransition } from '@tax-assistant/validators'

import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { requireUser } from './auth'

type OrderPatch = Partial<Omit<WithoutSystemFields<Doc<'orders'>>, 'status'>>

/** The single guarded path for every order status change. */
export async function transition(
  ctx: MutationCtx,
  order: Doc<'orders'>,
  to: OrderStatus,
  patch: OrderPatch = {},
): Promise<void> {
  if (!canTransition(order.status, to)) {
    throw new ConvexError({
      code: 'BAD_TRANSITION',
      message: `Недопустимый переход: ${order.status} → ${to}`,
    })
  }
  await ctx.db.patch(order._id, { ...patch, status: to })
}

export async function postSystem(
  ctx: MutationCtx,
  orderId: Id<'orders'>,
  body: string,
): Promise<void> {
  await ctx.db.insert('messages', {
    orderId,
    senderRole: 'system',
    body,
    attachmentIds: [],
    createdAt: Date.now(),
  })
}

export type ParticipantRole = 'customer' | 'executor' | 'admin'

/** Resolve the caller's relationship to an order, or throw 403. */
export async function loadParticipant(
  ctx: QueryCtx | MutationCtx,
  orderId: Id<'orders'>,
): Promise<{ user: Doc<'users'>; order: Doc<'orders'>; role: ParticipantRole }> {
  const user = await requireUser(ctx)
  const order = await ctx.db.get(orderId)
  if (!order) throw new ConvexError({ code: 'NOT_FOUND', message: 'Заявка не найдена' })

  if (user.role === 'admin') return { user, order, role: 'admin' }
  if (order.customerId === user._id) return { user, order, role: 'customer' }
  if (order.assignedExecutorId === user._id) return { user, order, role: 'executor' }
  throw new ConvexError({ code: 'FORBIDDEN', message: 'Нет доступа к заявке' })
}
