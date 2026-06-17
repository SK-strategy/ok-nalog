'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation } from 'convex/react'
import { Send } from 'lucide-react'

import { useSession } from '~/entities/session'
import { api } from '~/shared/api'
import { useAuthClient } from '~/shared/lib/auth-client'

// The link collided with a Telegram-born account → offer to merge.
const COLLISION_CODES = new Set([
  'account_already_linked_to_different_user',
  'unable_to_link_account',
])

function convexErrorCode(e: unknown): string | undefined {
  const data = (e as { data?: unknown }).data
  if (data && typeof data === 'object') return (data as { code?: string }).code
  return undefined
}

/**
 * «Привязать Telegram» for email-born accounts. linkSocial with the
 * telegram-oidc provider redirects to oauth.telegram.org; the callback attaches
 * the account to the current user (link context rides the OAuth state, so the
 * crossDomain cookie split is irrelevant), and server hooks stamp
 * user.telegramId — afterwards the same профиль works in the Mini App and via
 * «Войти через Telegram».
 *
 * If the Telegram already belongs to a separate (TMA-born) account, the link
 * is refused and a merge candidate is recorded server-side; we then offer
 * «это мой аккаунт — объединить» → merge.requestSelfMerge, which folds that
 * account into this one (dual control proven: live session + Telegram OAuth).
 *
 * Hidden once the profile has a Telegram identity.
 */
export function LinkTelegramCard() {
  const authClient = useAuthClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { me } = useSession()
  const requestSelfMerge = useMutation(api.merge.requestSelfMerge)
  const [pending, setPending] = useState(false)
  // A failed link redirects back with ?error=… — derive both flags once at
  // mount (in initializers, not an effect, to avoid a cascading re-render). A
  // collision code means a mergeable duplicate exists server-side.
  const initialErrorCode = searchParams.get('error')
  const [canMerge, setCanMerge] = useState(() =>
    initialErrorCode ? COLLISION_CODES.has(initialErrorCode) : false,
  )
  const [error, setError] = useState<string | null>(() =>
    initialErrorCode && !COLLISION_CODES.has(initialErrorCode)
      ? 'Не получилось привязать Telegram. Попробуйте ещё раз.'
      : null,
  )

  // Strip the ?error= param so a refresh starts clean (state already holds it).
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

  const merge = async () => {
    setPending(true)
    setError(null)
    try {
      await requestSelfMerge({})
      // Success: the domain user gains telegramId → the reactive `me` query
      // re-runs and this card unmounts. Refresh the auth session too.
      ;(authClient as unknown as { updateSession?: () => void }).updateSession?.()
    } catch (e) {
      const code = convexErrorCode(e)
      setCanMerge(false)
      setError(
        code === 'EXECUTOR_MERGE_CONFLICT' || code === 'ADMIN_MERGE_CONFLICT'
          ? 'Этот Telegram у аккаунта с историей. Напишите в поддержку, чтобы объединить безопасно.'
          : code === 'NO_PENDING_MERGE'
            ? 'Срок действия истёк. Нажмите «Привязать Telegram» ещё раз.'
            : 'Не удалось объединить аккаунты. Попробуйте ещё раз.',
      )
      setPending(false)
    }
  }

  return (
    <div
      className="bg-card has-[button:hover]:bg-secondary/40 flex flex-col gap-3 rounded-2xl border
        p-4 transition-colors"
    >
      <div className="flex items-center gap-3">
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
              (canMerge
                ? 'Этот Telegram уже использовался в мини-приложении. Это вы? Объедините аккаунты в один.'
                : 'Вход в один клик и мини-приложение в Telegram — с этим же аккаунтом и обращениями.')}
          </p>
        </div>
        {!canMerge && (
          <button
            type="button"
            onClick={() => void link()}
            disabled={pending}
            className="text-primary shrink-0 text-[13px] font-semibold disabled:opacity-60"
          >
            {pending ? 'Перенаправление…' : 'Привязать'}
          </button>
        )}
      </div>
      {canMerge && (
        <button
          type="button"
          onClick={() => void merge()}
          disabled={pending}
          className="bg-primary text-primary-foreground w-full rounded-xl py-2.5 text-[13px]
            font-semibold transition-opacity active:opacity-80 disabled:opacity-60"
        >
          {pending ? 'Объединяем…' : 'Это мой аккаунт — объединить'}
        </button>
      )}
    </div>
  )
}
