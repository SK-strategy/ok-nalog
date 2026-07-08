import type { Id } from '../_generated/dataModel'

// Payment provider seam. The order lifecycle only cares that *something*
// confirms a payment (webhook or admin), so the PSP specifics live here behind
// a tiny interface:
//   - `activeProvider()` picks the gateway from env.
//   - `providerPaymentIdFor()` mints the id we hand the gateway; its webhook
//     echoes it back so we can find the local `payments` row.
//   - `verifyWebhookSignature()` authenticates the callback.
// `mock` is fully wired for local/dev (see http.ts `/payments/mock-pay`). Real
// gateways (ЮKassa, Telegram Payments) plug in at `payments.checkout` (create
// the hosted intent) and here (signature scheme) — no lifecycle code changes.

export type PaymentProvider = 'mock' | 'yookassa' | 'telegram'

export function activeProvider(): PaymentProvider {
  const p = process.env.PAYMENTS_PROVIDER
  if (p === 'yookassa' || p === 'telegram') return p
  return 'mock'
}

/** Stable id handed to the gateway; its webhook returns it to locate the row. */
export function providerPaymentIdFor(
  provider: PaymentProvider,
  orderId: Id<'orders'>,
  seed: number,
): string {
  return `${provider}_${orderId}_${seed}`
}

/**
 * Authenticate a webhook callback: HMAC-SHA256 (hex) of the raw request body
 * keyed with `PAYMENTS_WEBHOOK_SECRET`, compared in constant time. Returns
 * false when either the secret or the signature is missing — fail closed.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHex: string | null,
  secret: string | undefined,
): Promise<boolean> {
  if (!secret || !signatureHex) return false
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody))
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return timingSafeEqualHex(expected, signatureHex.trim().toLowerCase())
}

/** Length-checked, constant-time hex comparison. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
