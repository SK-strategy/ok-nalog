import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

// Enqueue side of the Telegram notification outbox. Delivery lives in
// `apps/bot`; everything here is about deciding *whether* to notify and
// *what may be said*.

/** Longest excerpt we put in a Telegram message before an ellipsis. */
export const PREVIEW_MAX_CHARS = 180

/** First retry delay; doubles per attempt in `notifications.reportResults`. */
export const RETRY_BASE_MS = 30_000

export type NotificationKind = 'order_reply' | 'moderator_note'
export type ActorRole = 'customer' | 'executor' | 'moderator'

/**
 * Squash a message body into a one-paragraph excerpt.
 *
 * Newlines collapse because Telegram renders the quote inline and a pasted
 * multi-line document would blow the notification up to full height. An
 * attachment-only message has no text at all, so it gets a stand-in rather
 * than an empty quote.
 */
export function buildPreview(body: string, attachmentCount: number): string {
  const flat = body.replace(/\s+/gu, ' ').trim()
  if (!flat) {
    if (attachmentCount > 0) {
      return attachmentCount === 1 ? '📎 Вложение' : `📎 Вложений: ${attachmentCount}`
    }
    return '(пустое сообщение)'
  }
  const withFiles =
    attachmentCount > 0 ? `${flat} 📎${attachmentCount > 1 ? ` ${attachmentCount}` : ''}` : flat
  if (withFiles.length <= PREVIEW_MAX_CHARS) return withFiles
  // Trim on a word boundary when one is near the cut, so the excerpt doesn't
  // end mid-word.
  const cut = withFiles.slice(0, PREVIEW_MAX_CHARS)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > PREVIEW_MAX_CHARS - 30 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/**
 * Queue one notification, coalescing into an existing undelivered row for the
 * same (user, order, kind).
 *
 * Coalescing matters: an expert typing five short messages should buzz the
 * client's phone once, showing the latest line — not five times. Because the
 * row is rewritten rather than duplicated, the excerpt the user finally sees is
 * always the most recent one.
 *
 * Silently does nothing when the target can't receive Telegram messages —
 * email-only signups carry `telegramId: ''`, and blocked users are flagged.
 * That's a normal state, not an error: notification is a courtesy channel and
 * must never fail the mutation that triggered it.
 */
export async function enqueueNotification(
  ctx: MutationCtx,
  args: {
    userId: Id<'users'>
    orderId: Id<'orders'>
    kind: NotificationKind
    actorRole: ActorRole
    preview: string
    categoryTitle?: string
  },
): Promise<void> {
  const user = await ctx.db.get(args.userId)
  if (!user) return
  // No Telegram identity (email-only signup) or the bot is blocked → nothing
  // deliverable. Skip at enqueue time so the queue only holds real work.
  if (!user.telegramId) return
  if (user.botBlockedAt !== undefined) return

  const now = Date.now()
  const existing = await ctx.db
    .query('notifications')
    .withIndex('by_target', (q) =>
      q
        .eq('userId', args.userId)
        .eq('orderId', args.orderId)
        .eq('kind', args.kind)
        .eq('status', 'pending'),
    )
    .first()

  if (existing) {
    // Refresh the excerpt but keep `attempts`/`nextAttemptAt` — a new message
    // must not reset a backoff that's currently protecting a failing chat.
    await ctx.db.patch(existing._id, {
      preview: args.preview,
      actorRole: args.actorRole,
      categoryTitle: args.categoryTitle,
    })
    return
  }

  await ctx.db.insert('notifications', {
    userId: args.userId,
    orderId: args.orderId,
    kind: args.kind,
    actorRole: args.actorRole,
    preview: args.preview,
    categoryTitle: args.categoryTitle,
    status: 'pending',
    attempts: 0,
    nextAttemptAt: now,
    createdAt: now,
  })
}

/**
 * Who, if anyone, should hear about activity on this order — expressed as the
 * counterparty of whoever acted.
 *
 * Returns `null` rather than throwing when there's nobody to tell (no expert
 * assigned yet, order already closed): both are ordinary states.
 */
export function counterpartyOf(
  order: Doc<'orders'>,
  senderRole: 'customer' | 'executor',
): Id<'users'> | null {
  if (senderRole === 'customer') return order.assignedExecutorId ?? null
  return order.customerId
}
