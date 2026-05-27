'use client'

import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { ConvexReactClient } from 'convex/react'

import { SessionProvider } from '~/entities/session'
import { env } from '~/shared/config'
import { authClient } from '~/shared/lib/auth-client'

// Module-scope singleton so it survives hot reloads / re-renders.
// `expectAuth: true` makes queries wait for `setAuth(...)` from
// ConvexBetterAuthProvider before firing — avoids a flash of unauth'd requests.
const convex = new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL, {
  expectAuth: true,
})

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <SessionProvider>{children}</SessionProvider>
    </ConvexBetterAuthProvider>
  )
}
