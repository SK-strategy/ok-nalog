'use client'

import { useEffect, useState } from 'react'

import { useAuthClient } from '~/shared/lib/auth-client'

export const RESEND_COOLDOWN_S = 60

export type LinkEmailStep = 'email' | 'otp' | 'done'

// Plugin errors carry an UPPER_SNAKE `code`; the two change-email config
// errors arrive message-only (better-auth fromStatus), hence the matching.
function describeLinkError(error: { code?: string; message?: string } | null): string {
  switch (error?.code) {
    case 'INVALID_OTP':
      return 'Неверный код. Проверьте письмо и попробуйте ещё раз.'
    case 'OTP_EXPIRED':
      return 'Код истёк — запросите новый.'
    case 'TOO_MANY_ATTEMPTS':
      return 'Слишком много попыток — запросите новый код.'
    case 'INVALID_EMAIL':
      return 'Похоже, в адресе опечатка.'
    default:
      if (error?.message === 'Email already in use') {
        return 'Эта почта уже привязана к другому аккаунту.'
      }
      return 'Не получилось. Попробуйте ещё раз.'
  }
}

/**
 * Attach a real email to the Telegram-born better-auth user so the same
 * account works on the web/admin apps via email-OTP login.
 *
 * Flow (server side is better-auth's OTP change-email, verify-then-change):
 *   1. requestEmailChange({ newEmail })  → 6-digit code goes to the NEW email
 *   2. changeEmail({ newEmail, otp })    → email + emailVerified=true applied
 *      atomically; "Email already in use" surfaces here.
 *
 * Anti-enumeration caveat: when the address already belongs to another
 * account, step 1 still answers success but sends nothing — the «код не
 * приходит» hint in the UI covers that case.
 */
export function useLinkEmail() {
  const authClient = useAuthClient()
  const session = authClient.useSession()
  const currentEmail = session.data?.user.email ?? null
  const linkedEmail =
    currentEmail && !currentEmail.endsWith('@telegram.local') ? currentEmail : null

  const [step, setStep] = useState<LinkEmailStep>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const requestCode = async () => {
    const trimmed = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setError('Введите адрес почты.')
      return
    }
    if (trimmed === currentEmail?.toLowerCase()) {
      setError('Эта почта уже привязана к вашему аккаунту.')
      return
    }
    setPending(true)
    setError(null)
    const { error: err } = await authClient.emailOtp.requestEmailChange({ newEmail: trimmed })
    setPending(false)
    if (err) {
      setError(describeLinkError(err))
      return
    }
    setEmail(trimmed)
    setOtp('')
    setStep('otp')
    setCooldown(RESEND_COOLDOWN_S)
  }

  const confirm = async () => {
    setPending(true)
    setError(null)
    const { error: err } = await authClient.emailOtp.changeEmail({
      newEmail: email,
      otp: otp.trim(),
    })
    setPending(false)
    if (err) {
      setError(describeLinkError(err))
      return
    }
    // The email-otp client pings $sessionSignal for sign-in/verify paths but
    // not for /email-otp/change-email — kick the session store manually so
    // useSession picks up the new email (same workaround as TmaAuthGate).
    ;(authClient as unknown as { updateSession?: () => void }).updateSession?.()
    setStep('done')
  }

  const reset = () => {
    setStep('email')
    setEmail('')
    setOtp('')
    setError(null)
    setPending(false)
  }

  return {
    /** Real linked email, or null while only the Telegram placeholder is set. */
    linkedEmail,
    isLoading: session.isPending,
    step,
    email,
    setEmail,
    otp,
    setOtp,
    pending,
    error,
    cooldown,
    requestCode,
    confirm,
    reset,
  }
}

export type LinkEmailController = ReturnType<typeof useLinkEmail>
