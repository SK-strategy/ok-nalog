'use client'

import { createContext, use } from 'react'
import { convexClient, crossDomainClient } from '@convex-dev/better-auth/client/plugins'
import { telegramClient } from 'better-auth-telegram/client'
import { emailOTPClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

// Factory so the auth client picks up `CONVEX_SITE_URL` from the server-rendered
// RootLayout at request time instead of from a build-time-inlined NEXT_PUBLIC_*.
// `crossDomainClient` keeps the auth cookie alive across the app↔Convex origin
// split by stashing it in localStorage and replaying it as a header on every
// request, so we don't need SameSite=None+Secure on the cookie itself.
export function createAuthClientFor(baseURL: string) {
  return createAuthClient({
    baseURL,
    plugins: [telegramClient(), emailOTPClient(), convexClient(), crossDomainClient()],
  })
}

export type AuthClient = ReturnType<typeof createAuthClientFor>

export const AuthClientContext = createContext<AuthClient | null>(null)

export function useAuthClient(): AuthClient {
  const c = use(AuthClientContext)
  if (!c) throw new Error('useAuthClient must be used within <Providers>')
  return c
}
