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
  },
  client: {},
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    CONVEX_URL: process.env.CONVEX_URL,
    CONVEX_SITE_URL: process.env.CONVEX_SITE_URL,
  },
  skipValidation: !!process.env.CI || process.env.npm_lifecycle_event === 'lint',
})
