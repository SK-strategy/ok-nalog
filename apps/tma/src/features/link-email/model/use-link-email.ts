'use client'

import { useEffect, useState } from 'react'
import { useAction } from 'convex/react'

import { api } from '~/shared/api'
import { useAuthClient } from '~/shared/lib/auth-client'

export const RESEND_COOLDOWN_S = 60

export type LinkEmailStep = 'email' | 'otp' | 'done'
// 'change' = attach a fresh email to this account (better-auth change-email).
// 'merge'  = the email already belongs to a separate account; prove control of
//            its inbox to fold that account into this one.
export type LinkEmailMode = 'change' | 'merge'

// Plugin errors carry an UPPER_SNAKE `code`; the change-email config errors and
// ConvexError merge codes arrive as `code` too.
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
    case 'EXECUTOR_MERGE_CONFLICT':
      return 'Оба аккаунта — исполнители с историей. Напишите в поддержку, чтобы объединить их безопасно.'
    case 'SELF_ORDER_CONFLICT':
      return 'В одной из заявок вы и заказчик, и исполнитель. Напишите в поддержку.'
    default:
      if (error?.message === 'Email already in use') {
        return 'Эта почта уже привязана к другому аккаунту.'
      }
      return 'Не получилось. Попробуйте ещё раз.'
  }
}

// ConvexError surfaces its payload under error.data (which may be the
// {code,message} object we threw, or a string).
function convexErrorCode(e: unknown): { code?: string; message?: string } {
  const data = (e as { data?: unknown }).data
  if (data && typeof data === 'object') return data as { code?: string; message?: string }
  if (typeof data === 'string') return { message: data }
  return { message: e instanceof Error ? e.message : undefined }
}

/**
 * Attach a real email to the Telegram-born account so the same профиль works on
 * web/admin via email-OTP login — and, if that email already belongs to a
 * separate account, fold the two into one.
 *
 * Fresh email → better-auth change-email (verify-then-change, OTP to the new
 * address). Taken email → the change-email OTP is silently suppressed
 * (anti-enumeration), so the user taps «объединить»: merge.requestEmailMerge
 * sends a code to that inbox; entering it proves dual control and
 * merge.confirmEmailMerge merges the email-born account into this one.
 */
export function useLinkEmail() {
  const authClient = useAuthClient()
  const requestEmailMerge = useAction(api.merge.requestEmailMerge)
  const confirmEmailMerge = useAction(api.merge.confirmEmailMerge)
  const session = authClient.useSession()
  const currentEmail = session.data?.user.email ?? null
  const linkedEmail =
    currentEmail && !currentEmail.endsWith('@telegram.local') ? currentEmail : null

  const [step, setStep] = useState<LinkEmailStep>('email')
  const [mode, setMode] = useState<LinkEmailMode>('change')
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
    setMode('change')
    setStep('otp')
    setCooldown(RESEND_COOLDOWN_S)
  }

  // Switch to the merge flow: the email belongs to another account, so send a
  // merge code to its inbox to prove the user controls it.
  const startMerge = async () => {
    setPending(true)
    setError(null)
    try {
      await requestEmailMerge({ email: email.trim().toLowerCase() })
      setMode('merge')
      setOtp('')
      setCooldown(RESEND_COOLDOWN_S)
    } catch (e) {
      setError(describeLinkError(convexErrorCode(e)))
    } finally {
      setPending(false)
    }
  }

  const confirm = async () => {
    setPending(true)
    setError(null)
    if (mode === 'change') {
      const { error: err } = await authClient.emailOtp.changeEmail({
        newEmail: email,
        otp: otp.trim(),
      })
      setPending(false)
      if (err) {
        setError(describeLinkError(err))
        return
      }
    } else {
      try {
        await confirmEmailMerge({ otp: otp.trim() })
      } catch (e) {
        setPending(false)
        setError(describeLinkError(convexErrorCode(e)))
        return
      }
      setPending(false)
    }
    // The email-otp client pings $sessionSignal for sign-in/verify, but not for
    // change-email or our merge actions — kick the session store so useSession
    // (and the reactive `me` query) pick up the new email.
    ;(authClient as unknown as { updateSession?: () => void }).updateSession?.()
    setStep('done')
  }

  const reset = () => {
    setStep('email')
    setMode('change')
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
    mode,
    email,
    setEmail,
    otp,
    setOtp,
    pending,
    error,
    cooldown,
    requestCode,
    startMerge,
    confirm,
    reset,
  }
}

export type LinkEmailController = ReturnType<typeof useLinkEmail>
