'use client'

import { convexClient, crossDomainClient } from '@convex-dev/better-auth/client/plugins'
import { telegramClient } from 'better-auth-telegram/client'
import { createAuthClient } from 'better-auth/react'

import { env } from '~/shared/config'

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_CONVEX_SITE_URL,
  plugins: [telegramClient(), convexClient(), crossDomainClient()],
})
