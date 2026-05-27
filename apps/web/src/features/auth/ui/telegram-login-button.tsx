'use client'

import { useState } from 'react'

import { Button } from '@tax-assistant/ui/button'

import { authClient } from '~/shared/lib/auth-client'

/**
 * Telegram OIDC sign-in. Redirects the user to oauth.telegram.org; on success
 * Telegram redirects back to `/api/auth/callback/telegram-oidc` on the Convex
 * site. The crossDomain after-hook tacks an `?ott=…` token onto the redirect
 * Location and the auth client picks it up on arrival to exchange for a
 * session.
 *
 * `callbackURL` is an absolute URL on purpose: relative paths get rewritten
 * by crossDomain against its single configured `siteUrl`, so a `/`-style
 * callback would send the admin app's sign-in back to the web origin. Using
 * `window.location.origin` keeps every app on its own host.
 */
export function TelegramLoginButton() {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const onClick = async () => {
    setPending(true)
    setError(null)
    try {
      await authClient.signInWithTelegramOIDC({
        callbackURL: `${window.location.origin}/`,
      })
    } catch {
      setError('Не удалось войти через Telegram')
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button onClick={onClick} disabled={pending} size="lg">
        {pending ? 'Перенаправление…' : 'Войти через Telegram'}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  )
}
