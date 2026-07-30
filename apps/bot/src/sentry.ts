import * as Sentry from '@sentry/node'

import { env } from './env.ts'

// Error reporting for the notification worker.
//
// This service is the one part of the system with no user in front of it. The
// Next.js apps surface a failure to somebody who can complain; a broken bot
// just goes quiet, and "nobody got a notification" is a very slow way to find
// out. So the interesting failures here are reported rather than only logged.
//
// Unset DSN → `init` is skipped and every capture below is a no-op, matching
// `apps/*/src/instrumentation.ts`. Nothing has to be conditional at call sites.

export function initSentry(): void {
  if (!env.SENTRY_DSN) return
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    // Same reasoning as the apps: errors are what anyone is going to look at,
    // and traces on a 3-second poll loop would be mostly noise about waiting.
    tracesSampleRate: 0,
  })
}

/**
 * Report a handled error, tagged so it groups by where it came from.
 *
 * `flush` is deliberately absent here — these fire from a long-running loop
 * that will still be alive when the transport gets around to sending.
 */
export function captureError(error: unknown, where: string, extra?: Record<string, unknown>): void {
  if (!env.SENTRY_DSN) return
  Sentry.withScope((scope) => {
    scope.setTag('component', where)
    if (extra) scope.setContext('detail', extra)
    Sentry.captureException(error)
  })
}

/**
 * Report a fatal, then wait for it to actually leave the process.
 *
 * Without the flush the process exits first and the event is lost — which is
 * exactly the error you most wanted to see. Bounded so a dead Sentry can't stop
 * the container from exiting and being restarted.
 */
export async function captureFatal(error: unknown): Promise<void> {
  if (!env.SENTRY_DSN) return
  Sentry.captureException(error)
  await Sentry.flush(2000).catch(() => undefined)
}
