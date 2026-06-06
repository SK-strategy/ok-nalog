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

// URLs are passed in from the server RootLayout (read at request time from
// `process.env.CONVEX_URL` / `CONVEX_SITE_URL`). `useState` initializers run
// exactly once per mount, so the convex+auth clients survive re-renders without
// the module-singleton pattern that would have to know URLs at import time.
//
// `expectAuth: true` makes Convex queries wait for `setAuth(...)` from
// ConvexBetterAuthProvider before firing — avoids a flash of unauth'd requests.
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
