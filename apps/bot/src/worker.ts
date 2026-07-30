import type { Bot } from 'grammy'
import { GrammyError, HttpError } from 'grammy'

import type { DeliverableNotification, DeliveryResult } from './convex.ts'
import { fetchPending, reportResults } from './convex.ts'
import { env } from './env.ts'
import { renderNotification } from './format.ts'
import { captureError } from './sentry.ts'

// Delivery half of the notification outbox. Convex decides what to say; this
// decides when it actually reaches Telegram, and how to react when it doesn't.

/**
 * Gap between individual sends.
 *
 * Telegram tolerates roughly 30 messages/second overall and about one per
 * second to the same chat. Our volume is nowhere near that, so a small fixed
 * pause is enough and avoids pulling in a throttler dependency. If this ever
 * fans out to broadcasts, replace this with `@grammyjs/transformer-throttler`
 * rather than shrinking the delay.
 */
const SEND_GAP_MS = 120

/** Consecutive failed polls before the outage is worth a Sentry event. */
const REPORT_AFTER_FAILURES = 3

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Classify a send failure.
 *
 * `blocked` means "stop trying for this recipient" and flags the user, so
 * nothing is queued for them again. `failed` is transient and gets exponential
 * backoff. Misclassifying a 429 as blocked would switch someone's
 * notifications off indefinitely, so the blocked bucket stays narrow.
 *
 * Note `chat not found` also covers a user who has simply never pressed
 * /start. Flagging them is still right — every send would fail the same way —
 * and it isn't a dead end: `/start` clears `botBlockedAt`, so they recover the
 * moment they open the bot.
 */
function classify(error: unknown): { outcome: 'blocked' | 'failed'; message: string } {
  if (error instanceof GrammyError) {
    const description = error.description
    const permanent =
      error.error_code === 403 || // bot blocked / kicked
      /user is deactivated/iu.test(description) ||
      /chat not found/iu.test(description)
    return {
      outcome: permanent ? 'blocked' : 'failed',
      message: `${error.error_code}: ${description}`,
    }
  }
  if (error instanceof HttpError) return { outcome: 'failed', message: `network: ${error.message}` }
  return { outcome: 'failed', message: error instanceof Error ? error.message : String(error) }
}

/** Telegram's own advice on how long to wait, when it gives any. */
function retryAfterMs(error: unknown): number | null {
  if (error instanceof GrammyError && error.error_code === 429) {
    const seconds = error.parameters.retry_after
    if (typeof seconds === 'number') return seconds * 1000
  }
  return null
}

async function deliverOne(bot: Bot, n: DeliverableNotification): Promise<DeliveryResult> {
  const { text, orderUrl } = renderNotification(n)
  // Single definition shared by the first attempt and the 429 retry — two
  // copies would silently drift the day someone edits only one.
  const send = (): Promise<unknown> =>
    bot.api.sendMessage(n.chatId, text, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: { inline_keyboard: [[{ text: 'Открыть заявку', url: orderUrl }]] },
    })

  try {
    await send()
    return { id: n.id, outcome: 'delivered' }
  } catch (error) {
    // A 429 is worth one in-line wait: Telegram tells us exactly how long, and
    // honouring it immediately usually lands the message rather than pushing it
    // into a 30-second backoff. Anything longer is left to the queue rather
    // than blocking the whole batch on one chat.
    const wait = retryAfterMs(error)
    if (wait !== null && wait <= 5_000) {
      await sleep(wait)
      try {
        await send()
        return { id: n.id, outcome: 'delivered' }
      } catch (retryError) {
        const { outcome, message } = classify(retryError)
        return { id: n.id, outcome, error: message }
      }
    }
    const { outcome, message } = classify(error)
    return { id: n.id, outcome, error: message }
  }
}

/** One poll cycle. Returns how many rows were acted on. */
export async function drainOnce(bot: Bot): Promise<number> {
  const pending = await fetchPending()
  if (pending.length === 0) return 0

  const results: DeliveryResult[] = []
  for (const n of pending) {
    if (n.undeliverable) {
      results.push({ id: n.id, outcome: 'undeliverable' })
      continue
    }
    results.push(await deliverOne(bot, n))
    await sleep(SEND_GAP_MS)
  }

  await reportResults(results)
  return results.length
}

/**
 * Poll-and-deliver loop.
 *
 * Polling rather than a push from Convex, deliberately: this service needs no
 * inbound reachability (no public route, no webhook secret to rotate), and it
 * recovers on its own after a restart or an outage by simply finding whatever
 * is still `pending`. At a few-second cadence against an indexed, usually-empty
 * query, the cost is negligible.
 *
 * The loop never throws — a Convex blip must not kill the process, because the
 * same process is also serving the bot's `/start` handler.
 */
export function startWorker(bot: Bot, signal: AbortSignal): Promise<void> {
  return (async () => {
    let failures = 0
    while (!signal.aborted) {
      try {
        const handled = await drainOnce(bot)
        failures = 0
        // Nothing queued → wait the full interval. Work found → come straight
        // back, so a backlog drains in batches instead of one batch per tick.
        if (handled === 0) await sleep(env.BOT_POLL_INTERVAL_MS)
      } catch (error) {
        failures++
        console.error(`[worker] poll failed (${failures}):`, error)
        // Report the streak, not every tick. A single failure is usually a
        // Convex restart mid-deploy and self-heals within a poll or two; at a
        // 3s cadence, reporting each one would send hundreds of identical
        // events through any real outage. Three in a row means it isn't a blip
        // — that's the threshold the /bot/* routing bug would have tripped.
        if (failures === REPORT_AFTER_FAILURES) {
          captureError(error, 'worker.poll', { consecutiveFailures: failures })
        }
        // Back off when Convex is unreachable so we don't spin a hot loop
        // against a down backend. Caps at ~30s.
        await sleep(Math.min(env.BOT_POLL_INTERVAL_MS * 2 ** failures, 30_000))
      }
    }
  })()
}
