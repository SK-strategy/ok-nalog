import { httpRouter } from 'convex/server'

import type { Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { httpAction } from './_generated/server'
import { authComponent, createAuth } from './auth'
import { activeProvider, verifyWebhookSignature } from './lib/payments'

const http = httpRouter()

// Mounts /api/auth/* — sign-in/callback/session/etc. — on the Convex
// HTTP actions origin (CONVEX_SITE_ORIGIN, port 3311 locally).
authComponent.registerRoutesLazy(http, createAuth, { cors: true })

// ── Payments ────────────────────────────────────────────────────────────────

// Provider callback → confirm payment. Authenticated by an HMAC-SHA256
// signature over the raw body (header `x-signature`, key PAYMENTS_WEBHOOK_SECRET)
// — never trust a webhook body without verifying it. Tolerant of a few common
// provider payload shapes; only a success event flips the order to `paid`.
http.route({
  path: '/payments/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const raw = await request.text()
    const signature = request.headers.get('x-signature')
    const ok = await verifyWebhookSignature(raw, signature, process.env.PAYMENTS_WEBHOOK_SECRET)
    if (!ok) return new Response('invalid signature', { status: 401 })

    let body: Record<string, unknown>
    try {
      body = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return new Response('bad json', { status: 400 })
    }

    const object = (body.object ?? {}) as Record<string, unknown>
    const providerPaymentId =
      (body.providerPaymentId as string | undefined) ?? (object.id as string | undefined)
    const event = (body.event ?? body.type) as string | undefined
    const isSuccess =
      event === 'payment.succeeded' || body.status === 'succeeded' || body.paid === true

    if (!providerPaymentId || !isSuccess) return new Response('ignored', { status: 200 })

    const result = await ctx.runMutation(internal.payments.markPaidByProvider, {
      providerPaymentId,
    })
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }),
})

// Dev-only mock checkout: confirms the payment on open. Disabled unless the
// active provider is `mock`, so it can never fire against a real deployment.
http.route({
  path: '/payments/mock-pay',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    if (activeProvider() !== 'mock') return new Response('disabled', { status: 404 })
    const pid = new URL(request.url).searchParams.get('pid')
    if (!pid) return new Response('missing pid', { status: 400 })
    await ctx.runMutation(internal.payments.markPaidByProvider, { providerPaymentId: pid })
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Оплата</title>' +
        '<body style="font-family:system-ui,sans-serif;padding:2rem;text-align:center">' +
        '<h2>Оплата прошла ✅</h2><p>Можно вернуться в приложение.</p>',
      { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
    )
  }),
})

// ── Telegram notification bot ───────────────────────────────────────────────
//
// The `apps/bot` worker's only door into Convex. Authenticated with a static
// bearer token (BOT_SERVICE_SECRET) rather than a user session: the worker acts
// as the platform, not on behalf of any user, so there is no session to carry.
//
// Bearer-in-header rather than a secret in query/function args on purpose —
// Convex records function arguments in the dashboard's log stream, so a secret
// passed as an argument would be sitting in plaintext in the logs.

/**
 * Constant-time-ish bearer check. Compares length first, then every byte
 * without early exit, so a wrong token can't be recovered by timing the
 * response. `===` on secrets short-circuits at the first differing character.
 */
function bearerOk(request: Request): boolean {
  const expected = process.env.BOT_SERVICE_SECRET
  // Fail closed: an unset secret means the endpoint is off, not open.
  if (!expected) return false
  const header = request.headers.get('authorization') ?? ''
  const prefix = 'Bearer '
  if (!header.startsWith(prefix)) return false
  const got = header.slice(prefix.length)
  if (got.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

/** Shape the worker POSTs to `/bot/ack`; mirrors the mutation's validator. */
interface BotAckResult {
  id: Id<'notifications'>
  outcome: 'delivered' | 'blocked' | 'failed' | 'undeliverable'
  error?: string
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

/** Notifications ready to send. Returns `[]` when the queue is empty. */
http.route({
  path: '/bot/pending',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!bearerOk(request)) return json({ error: 'unauthorized' }, 401)
    let limit: number | undefined
    try {
      const body = (await request.json()) as { limit?: number }
      limit = body.limit
    } catch {
      // No body is fine — the worker may just ask for the default batch.
    }
    return json({ notifications: await ctx.runQuery(internal.notifications.pending, { limit }) })
  }),
})

/** Delivery outcomes for a batch the worker just attempted. */
http.route({
  path: '/bot/ack',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!bearerOk(request)) return json({ error: 'unauthorized' }, 401)
    let results: BotAckResult[]
    try {
      ;({ results } = (await request.json()) as { results: BotAckResult[] })
    } catch {
      return json({ error: 'bad json' }, 400)
    }
    if (!Array.isArray(results)) return json({ error: 'results must be an array' }, 400)
    // The mutation's own validators reject anything malformed, so a bad
    // outcome string fails loudly there rather than being silently dropped.
    return json(await ctx.runMutation(internal.notifications.reportResults, { results }))
  }),
})

/** `/start` and `/stop` in the bot chat. */
http.route({
  path: '/bot/chat',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!bearerOk(request)) return json({ error: 'unauthorized' }, 401)
    let telegramId: string
    let action: string
    try {
      ;({ telegramId, action } = (await request.json()) as {
        telegramId: string
        action: string
      })
    } catch {
      return json({ error: 'bad json' }, 400)
    }
    if (!telegramId) return json({ error: 'missing telegramId' }, 400)
    if (action === 'start') {
      return json(await ctx.runMutation(internal.notifications.registerChat, { telegramId }))
    }
    if (action === 'stop') {
      return json(await ctx.runMutation(internal.notifications.muteChat, { telegramId }))
    }
    return json({ error: 'unknown action' }, 400)
  }),
})

export default http
