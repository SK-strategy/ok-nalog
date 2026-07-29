import * as Sentry from '@sentry/nextjs'
import { env } from '~/env'

/**
 * Browser error reporting.
 *
 * The DSN is `NEXT_PUBLIC_` because it is read in the browser, which means
 * Next.js inlines it at build time — unlike `CONVEX_URL` and friends, this one
 * value is baked into the image and changing it needs a rebuild. A Sentry DSN
 * is a public write-only ingest key, so that's acceptable; it's called out here
 * because it's the one exception to this repo's env-agnostic image rule.
 *
 * Unset DSN → the SDK initialises nothing.
 */
if (env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: env.NEXT_PUBLIC_SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: 0,
  })
}

/** Instruments client-side navigations so errors carry the route they happened on. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
