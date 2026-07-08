import { httpRouter } from 'convex/server'

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

export default http
