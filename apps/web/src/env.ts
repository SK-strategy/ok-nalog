import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod/v4'

export const env = createEnv({
  shared: {
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  },
  server: {
    // Read in the server component RootLayout at request time and passed down
    // to <Providers> as plain props. Dropping the NEXT_PUBLIC_ prefix is what
    // stops Next.js from inlining the value into the client bundle — i.e.
    // what makes the prod image env-agnostic and re-deployable without rebuild.
    CONVEX_URL: z.url(),
    CONVEX_SITE_URL: z.url(),
    // Sentry is opt-in: with no DSN the SDK initialises nothing, so this stays
    // optional and an empty string is normalised to undefined (an unset var in
    // a .env file usually arrives as "").
    SENTRY_DSN: z
      .url()
      .optional()
      .or(z.literal('').transform(() => undefined)),
  },
  client: {
    // Read in the browser, so it must be NEXT_PUBLIC_ and is therefore inlined
    // at build time — the one value in this app that isn't swappable without a
    // rebuild. Acceptable because a Sentry DSN is a public write-only key.
    NEXT_PUBLIC_SENTRY_DSN: z
      .url()
      .optional()
      .or(z.literal('').transform(() => undefined)),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    CONVEX_URL: process.env.CONVEX_URL,
    CONVEX_SITE_URL: process.env.CONVEX_SITE_URL,
    SENTRY_DSN: process.env.SENTRY_DSN,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  skipValidation: !!process.env.CI || process.env.npm_lifecycle_event === 'lint',
})
