import { z } from 'zod/v4'

// The only place in this app allowed to touch `process.env` — eslint's
// `restrictEnvAccess` exempts `**/env.ts` and forbids it everywhere else, so
// every other module gets validated, typed values or nothing.

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  /**
   * The SAME bot as the Mini App and Login Widget. Reused deliberately: users
   * who opened the TMA have already started a chat with it, so notifications
   * work without a second onboarding step.
   *
   * Telegram allows exactly one long-polling consumer per token — run only one
   * replica of this service, or updates will be stolen back and forth between
   * them (`409 Conflict`).
   */
  TELEGRAM_BOT_TOKEN: z.string().min(1),

  /** Convex HTTP-actions origin, where the `/bot/*` routes live. */
  CONVEX_SITE_URL: z.url(),

  /** Shared secret for those routes. Must match the Convex deployment env. */
  BOT_SERVICE_SECRET: z.string().min(16, 'BOT_SERVICE_SECRET must be at least 16 chars'),

  /** Public web origin — used to build the "Открыть заявку" deep link. */
  WEB_ORIGIN: z.url(),

  /**
   * Outbox poll cadence. The queue is normally empty and the query is indexed,
   * so this is cheap; a few seconds of latency on a chat notification is
   * imperceptible.
   */
  BOT_POLL_INTERVAL_MS: z.coerce.number().int().min(500).default(3000),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  // Fail at boot with the full list rather than crashing later on the first
  // send with a confusing Telegram error.
  console.error('✗ Invalid bot environment:')
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
  }
  process.exit(1)
}

export const env = parsed.data
