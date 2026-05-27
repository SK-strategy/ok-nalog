import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod/v4'

export const env = createEnv({
  shared: {
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  },
  server: {},
  client: {
    // Convex websocket URL (queries/mutations).
    NEXT_PUBLIC_CONVEX_URL: z.url(),
    // Convex HTTP actions origin — where better-auth's /api/auth/* routes
    // are mounted (port 3311 locally). The auth client targets this.
    NEXT_PUBLIC_CONVEX_SITE_URL: z.url(),
  },
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    NEXT_PUBLIC_CONVEX_SITE_URL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
  },
  skipValidation: !!process.env.CI || process.env.npm_lifecycle_event === 'lint',
})
