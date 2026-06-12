'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Send } from 'lucide-react'

import { useSession } from '~/entities/session'
import { useAuthClient } from '~/shared/lib/auth-client'

// Codes arrive as ?error=… on the errorCallbackURL after the OAuth dance.
function describeLinkError(code: string): string {
  switch (code) {
    case 'account_already_linked_to_different_user':
    case 'unable_to_link_account':
      return 'Этот Telegram уже привязан к другому аккаунту — например, созданному автоматически в мини-приложении. Напишите нам, чтобы объединить аккаунты.'
    default:
      return 'Не получилось привязать Telegram. Попробуйте ещё раз.'
  }
}

/**
 * «Привязать Telegram» for email-born accounts. Runs better-auth's
 * linkSocial with the telegram-oidc provider: redirect to oauth.telegram.org
 * → callback on the Convex site origin attaches the account to the current
 * user (link context travels in the OAuth state, not cookies, so the
 * crossDomain split doesn't matter). Server-side hooks then stamp
 * user.telegramId, which the TMA and the domain mirror key on — after
 * linking, the same профиль works in the mini app and via «Войти через
 * Telegram».
 *
 * Hidden while the profile already has a Telegram identity (every
 * Telegram-born account does).
 */
export function LinkTelegramCard() {
  const authClient = useAuthClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { me } = useSession()
  const [pending, setPending] = useState(false)
  // A failed link redirects back with ?error=… — capture it once at mount.
  const [error, setError] = useState<string | null>(() => {
    const code = searchParams.get('error')
    return code ? describeLinkError(code) : null
  })

  // Strip the error param so a refresh starts clean (state already holds it).
  useEffect(() => {
    if (searchParams.get('error')) router.replace('/orders')
  }, [searchParams, router])

  if (!me || me.user.telegramId) return null

  const link = async () => {
    setPending(true)
    setError(null)
    try {
      const { data, error: err } = await authClient.linkSocial({
        provider: 'telegram-oidc',
        // Absolute URLs on purpose — crossDomain rewrites relative paths
        // against its single configured siteUrl.
        callbackURL: `${window.location.origin}/orders`,
        errorCallbackURL: `${window.location.origin}/orders`,
      })
      if (err) {
        setError('Не получилось привязать Telegram. Попробуйте ещё раз.')
        setPending(false)
        return
      }
      if (data.url) {
        window.location.href = data.url
        return
      }
      setPending(false)
    } catch {
      setError('Не получилось привязать Telegram. Попробуйте ещё раз.')
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void link()}
      disabled={pending}
      className="bg-card hover:bg-secondary/40 flex items-center gap-3 rounded-2xl border p-4
        text-left transition-colors disabled:opacity-70"
    >
      <div
        className="bg-primary-soft text-primary flex size-10 shrink-0 items-center justify-center
          rounded-[10px]"
      >
        <Send className="size-5" strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-[14px] font-semibold">Привязать Telegram</p>
        <p
          className={`mt-0.5 text-[12px] leading-snug
            ${error ? 'text-destructive' : 'text-text-soft'}`}
        >
          {error ??
            'Вход в один клик и мини-приложение в Telegram — с этим же аккаунтом и вашими обращениями.'}
        </p>
      </div>
      <span className="text-primary shrink-0 text-[13px] font-semibold">
        {pending ? 'Перенаправление…' : 'Привязать'}
      </span>
    </button>
  )
}
