'use client'

import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { ConvexReactClient } from 'convex/react'

import { TmaAuthGate } from '~/features/auth'
import { SessionProvider } from '~/entities/session'
import { env } from '~/shared/config'
import { authClient } from '~/shared/lib/auth-client'

const convex = new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL, {
  expectAuth: true,
})

// Auth is wrapped here once so every route mounts under an authenticated
// session — individual pages no longer have to remember to wrap themselves.
// In Telegram, `signInWithMiniApp` resolves before any page renders; outside
// Telegram the gate surfaces "Откройте приложение внутри Telegram".
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <SessionProvider>
        <TmaAuthGate>{children}</TmaAuthGate>
      </SessionProvider>
    </ConvexBetterAuthProvider>
  )
}
