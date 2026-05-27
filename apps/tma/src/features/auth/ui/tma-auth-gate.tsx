'use client'

import { useEffect, useRef, useState } from 'react'

import { Skeleton } from '@tax-assistant/ui'

import { useSession } from '~/entities/session'
import { authClient } from '~/shared/lib/auth-client'

interface TelegramWebApp {
  initData: string
  ready: () => void
  expand: () => void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

/**
 * Silent auth for the Mini App: read `initData` from the Telegram WebView and
 * hand it to better-auth's Mini App endpoint, which verifies the HMAC against
 * the bot token server-side and issues a session.
 *
 * Distinguishes between several "no children yet" states so we don't render a
 * blank Skeleton forever when something quietly goes wrong:
 *   - auth still resolving the stored session
 *   - signInWithMiniApp in flight
 *   - signed in but Convex `me` query still pending
 *   - signed in but Convex returned no user (subject/JWT mismatch — bug)
 *   - explicit error from signInWithMiniApp
 */
export function TmaAuthGate({ children }: { children: React.ReactNode }) {
  const { me, isAuthenticated, isLoading } = useSession()
  const attempted = useRef(false)
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (attempted.current || isAuthenticated) return
    attempted.current = true
    setSigningIn(true)
    void (async () => {
      const wa = window.Telegram?.WebApp
      wa?.ready()
      wa?.expand()
      const initData = wa?.initData
      if (!initData) {
        setError('Откройте приложение внутри Telegram')
        setSigningIn(false)
        return
      }
      try {
        const result = await authClient.signInWithMiniApp(initData)
        if (result.error) {
          console.error('signInWithMiniApp error', result.error)
          setError(`Не удалось авторизоваться: ${result.error.message ?? 'unknown'}`)
        } else {
          // crossDomainClient stores the session in localStorage on response,
          // but `useSession` only re-fetches when the session signal fires.
          // Plugin's own signIn methods don't notify, so we kick it manually.
          ;(authClient as unknown as { updateSession?: () => void }).updateSession?.()
        }
      } catch (e) {
        console.error('signInWithMiniApp threw', e)
        setError(`Не удалось авторизоваться: ${e instanceof Error ? e.message : 'unknown'}`)
      } finally {
        setSigningIn(false)
      }
    })()
  }, [isAuthenticated])

  if (error) {
    return (
      <div
        className="text-muted-foreground flex flex-col items-center gap-2 py-16 text-center text-sm"
      >
        {error}
      </div>
    )
  }

  // Signed in but Convex returned no user — JWT issuer/subject mismatch or
  // user wasn't persisted. Don't loop on a blank Skeleton; surface the bug.
  if (isAuthenticated && me === null) {
    return (
      <div
        className="text-muted-foreground flex flex-col items-center gap-2 py-16 text-center text-sm"
      >
        Сессия есть, но пользователь не найден в Convex. Попробуйте перезайти.
      </div>
    )
  }

  if (signingIn || isLoading || !me) {
    return (
      <div className="flex flex-col gap-3 py-10">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-24 w-full" />
        <p className="text-muted-foreground text-center text-xs">
          {signingIn
            ? 'Входим через Telegram…'
            : !isAuthenticated
              ? 'Проверяем сессию…'
              : me === undefined
                ? 'Загружаем профиль…'
                : 'Загрузка…'}
        </p>
      </div>
    )
  }

  return <>{children}</>
}
