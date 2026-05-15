'use client'

import { env } from '~/env'
import { ConvexProvider, ConvexReactClient } from 'convex/react'

// Module-scope so the singleton survives hot reloads / re-renders.
const convex = new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL)

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>
}
