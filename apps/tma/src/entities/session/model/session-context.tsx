'use client'

import type { FunctionReturnType } from 'convex/server'
import { createContext, use, useCallback, useMemo } from 'react'
import { useQuery } from 'convex/react'

import { api } from '~/shared/api'
import { useAuthClient } from '~/shared/lib/auth-client'

type Me = FunctionReturnType<typeof api.users.me>

interface SessionValue {
  me: Me | null | undefined
  isLoading: boolean
  isAuthenticated: boolean
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const authClient = useAuthClient()
  const auth = authClient.useSession()
  const isAuthenticated = !!auth.data?.user
  const me = useQuery(api.users.me, isAuthenticated ? {} : 'skip')

  const signOut = useCallback(async () => {
    await authClient.signOut()
  }, [authClient])

  const value = useMemo<SessionValue>(
    () => ({
      me: isAuthenticated ? me : null,
      isLoading: auth.isPending || (isAuthenticated && me === undefined),
      isAuthenticated,
      signOut,
    }),
    [me, auth.isPending, isAuthenticated, signOut],
  )

  return <SessionContext value={value}>{children}</SessionContext>
}

export function useSession(): SessionValue {
  const ctx = use(SessionContext)
  if (!ctx) throw new Error('useSession must be used within <SessionProvider>')
  return ctx
}
