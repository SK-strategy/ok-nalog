import { env } from './env.ts'

// Thin client for the authenticated `/bot/*` HTTP actions on Convex. This is
// the service's only channel to the platform — it holds no Convex session and
// acts as the platform itself, authenticated by a static bearer token.

export type NotificationKind = 'order_reply' | 'moderator_note'
export type ActorRole = 'customer' | 'executor' | 'moderator'

/** A row the worker should try to deliver. */
export interface DeliverableNotification {
  id: string
  undeliverable: false
  chatId: string
  orderId: string
  kind: NotificationKind
  actorRole: ActorRole
  preview: string
  categoryTitle: string | null
  attempts: number
}

/**
 * A row whose recipient lost their Telegram target between enqueue and now.
 * Reported back so it gets closed out instead of sitting pending forever.
 */
export interface UndeliverableNotification {
  id: string
  undeliverable: true
}

export type PendingNotification = DeliverableNotification | UndeliverableNotification

export type DeliveryOutcome = 'delivered' | 'blocked' | 'failed' | 'undeliverable'

export interface DeliveryResult {
  id: string
  outcome: DeliveryOutcome
  error?: string
}

/** Give up on a single HTTP call well before the poll interval comes round again. */
const REQUEST_TIMEOUT_MS = 10_000

async function call<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${env.CONVEX_SITE_URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${env.BOT_SERVICE_SECRET}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`${path} → ${response.status} ${response.statusText} ${detail}`.trim())
  }
  return (await response.json()) as T
}

export async function fetchPending(limit?: number): Promise<PendingNotification[]> {
  const { notifications } = await call<{ notifications: PendingNotification[] }>('/bot/pending', {
    limit,
  })
  return notifications
}

export async function reportResults(results: DeliveryResult[]): Promise<void> {
  if (results.length === 0) return
  await call('/bot/ack', { results })
}

/** `/start` — clears any previous mute/block and tells us if we know this user. */
export async function registerChat(telegramId: string): Promise<{ known: boolean }> {
  return call<{ known: boolean; name: string | null }>('/bot/chat', {
    telegramId,
    action: 'start',
  })
}

/** `/stop` — mute future notifications and drop anything already queued. */
export async function muteChat(telegramId: string): Promise<{ known: boolean }> {
  return call<{ known: boolean }>('/bot/chat', { telegramId, action: 'stop' })
}
