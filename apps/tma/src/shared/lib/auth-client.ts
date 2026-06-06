'use client'

import { createContext, use } from 'react'
import { convexClient, crossDomainClient } from '@convex-dev/better-auth/client/plugins'
import { telegramClient } from 'better-auth-telegram/client'
import { createAuthClient } from 'better-auth/react'

export function createAuthClientFor(baseURL: string) {
  return createAuthClient({
    baseURL,
    plugins: [telegramClient(), convexClient(), crossDomainClient()],
  })
}

export type AuthClient = ReturnType<typeof createAuthClientFor>

export const AuthClientContext = createContext<AuthClient | null>(null)

export function useAuthClient(): AuthClient {
  const c = use(AuthClientContext)
  if (!c) throw new Error('useAuthClient must be used within <Providers>')
  return c
}
