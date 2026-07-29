import * as Sentry from '@sentry/nextjs'
import { env } from '~/env'

/**
 * Server + edge error reporting.
 *
 * Next.js calls `register()` once per runtime at boot. Sentry is a no-op
 * without a DSN, so leaving `SENTRY_DSN` unset (the default in dev and in any
 * environment that hasn't been wired up yet) costs nothing and breaks nothing —
 * the SDK simply doesn't transmit. That's deliberate: the plumbing ships now,
 * the project/DSN gets configured later.
 */
export function register() {
  if (!env.SENTRY_DSN) return

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    // Traces are the expensive part and nothing reads them yet. Errors first;
    // raise this deliberately once someone is actually looking at performance.
    tracesSampleRate: 0,
  })
}

/**
 * Forwards errors from nested React Server Components, which otherwise never
 * reach `register()`'s handlers.
 */
export const onRequestError = Sentry.captureRequestError
