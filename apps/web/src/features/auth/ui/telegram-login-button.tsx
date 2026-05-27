'use client'

import { useState } from 'react'

import { Button } from '@tax-assistant/ui/button'

import { authClient } from '~/shared/lib/auth-client'

/**
 * Telegram OIDC sign-in. Redirects the user to oauth.telegram.org; on success
 * Telegram redirects back to `/api/auth/callback/telegram-oidc` on the Convex
 * site (3311). The auth client handles the rest — the user lands back at
 * `callbackURL` with a session in place.
 */
export function TelegramLoginButton() {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const onClick = async () => {
    setPending(true)
    setError(null)
    try {
      await authClient.signInWithTelegramOIDC({ callbackURL: '/' })
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
