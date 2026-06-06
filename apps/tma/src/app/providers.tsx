'use client'

import { useState } from 'react'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { ConvexReactClient } from 'convex/react'

import { TmaAuthGate } from '~/features/auth'
import { SessionProvider } from '~/entities/session'
import { AuthClientContext, createAuthClientFor } from '~/shared/lib/auth-client'

interface Props {
  convexUrl: string
  convexSiteUrl: string
  children: React.ReactNode
}

// Auth is wrapped here once so every route mounts under an authenticated
// session — individual pages no longer have to remember to wrap themselves.
// In Telegram, `signInWithMiniApp` resolves before any page renders; outside
// Telegram the gate surfaces "Откройте приложение внутри Telegram".
export function Providers({ convexUrl, convexSiteUrl, children }: Props) {
  const [convex] = useState(() => new ConvexReactClient(convexUrl, { expectAuth: true }))
  const [authClient] = useState(() => createAuthClientFor(convexSiteUrl))

  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <AuthClientContext value={authClient}>
        <SessionProvider>
          <TmaAuthGate>{children}</TmaAuthGate>
        </SessionProvider>
      </AuthClientContext>
    </ConvexBetterAuthProvider>
  )
}
