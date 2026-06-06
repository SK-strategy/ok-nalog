'use client'

import { useState } from 'react'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { ConvexReactClient } from 'convex/react'

import { SessionProvider } from '~/entities/session'
import { AuthClientContext, createAuthClientFor } from '~/shared/lib/auth-client'

interface Props {
  convexUrl: string
  convexSiteUrl: string
  children: React.ReactNode
}

export function Providers({ convexUrl, convexSiteUrl, children }: Props) {
  const [convex] = useState(() => new ConvexReactClient(convexUrl, { expectAuth: true }))
  const [authClient] = useState(() => createAuthClientFor(convexSiteUrl))

  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <AuthClientContext value={authClient}>
        <SessionProvider>{children}</SessionProvider>
      </AuthClientContext>
    </ConvexBetterAuthProvider>
  )
}
