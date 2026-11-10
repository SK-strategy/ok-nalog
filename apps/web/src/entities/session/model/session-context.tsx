'use client'

import type { FunctionReturnType } from 'convex/server'
import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from 'convex/react'

import { api } from '~/shared/api'
import { useAuthClient } from '~/shared/lib/auth-client'

type Me = FunctionReturnType<typeof api.users.me>

interface SessionValue {
  me: Me | null | undefined // undefined = loading, null = signed out
  isLoading: boolean
  isAuthenticated: boolean
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const authClient = useAuthClient()
  const auth = authClient.useSession()
  const isAuthenticated = !!auth.data?.user
  // better-auth flips `isPending` back to true on every background refetch
  // (window focus, tab switch) while signed out. Treating that as "loading"
  // unmounts the login form and wipes the typed email/code, so only the very
  // first resolution counts as loading.
  const [authSettled, setAuthSettled] = useState(false)
  useEffect(() => {
    if (!auth.isPending) setAuthSettled(true)
  }, [auth.isPending])
  const authLoading = auth.isPending && !authSettled
  // `api.users.me` returns both the better-auth user and the executor profile
  // summary needed for role-aware UI routing.
  const me = useQuery(api.users.me, isAuthenticated ? {} : 'skip')

  const signOut = useCallback(async () => {
    await authClient.signOut()
  }, [authClient])

  const value = useMemo<SessionValue>(
    () => ({
      me: isAuthenticated ? me : null,
      isLoading: authLoading || (isAuthenticated && me === undefined),
      isAuthenticated,
      signOut,
    }),
    [me, authLoading, isAuthenticated, signOut],
  )

  return <SessionContext value={value}>{children}</SessionContext>
}

export function useSession(): SessionValue {
  const ctx = use(SessionContext)
  if (!ctx) throw new Error('useSession must be used within <SessionProvider>')
  return ctx
}
