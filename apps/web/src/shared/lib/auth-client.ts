'use client'

import { convexClient, crossDomainClient } from '@convex-dev/better-auth/client/plugins'
import { telegramClient } from 'better-auth-telegram/client'
import { createAuthClient } from 'better-auth/react'

import { env } from '~/shared/config'

// Single auth client per app — talks to better-auth's HTTP routes mounted on
// the Convex backend (CONVEX_SITE_URL, port 3311). `crossDomainClient` is what
// makes auth survive the app↔Convex origin split locally: it stores the auth
// cookie in localStorage and replays it as a header on every request, so we
// don't need SameSite=None+Secure (which would require HTTPS).
export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_CONVEX_SITE_URL,
  plugins: [telegramClient(), convexClient(), crossDomainClient()],
})
