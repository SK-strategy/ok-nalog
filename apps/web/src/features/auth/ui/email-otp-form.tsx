'use client'

import { useEffect, useState } from 'react'

import { Button } from '@tax-assistant/ui/button'
import { Input } from '@tax-assistant/ui/input'

import { useAuthClient } from '~/shared/lib/auth-client'

const RESEND_COOLDOWN_S = 60

// Plugin errors carry an UPPER_SNAKE `code`; config-flow errors ("Email is
// the same", …) arrive message-only and fall through to the generic copy.
function describeOtpError(error: { code?: string; message?: string } | null): string {
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
      return 'Не получилось войти. Попробуйте ещё раз.'
  }
}

/**
 * Two-step passwordless login: адрес → 6-значный код из письма.
 *
 * `signIn.emailOtp` is a plain POST, so the crossDomain cookie bridge handles
 * it like the Mini App flow, and the client's session signal fires on success
 * — the surrounding gate re-renders into the signed-in state by itself.
 * Unknown emails become new customer accounts. The send endpoint answers
 * success even for undeliverable addresses (anti-enumeration), hence the
 * «код не пришёл» hint instead of a hard error.
 */
export function EmailOtpForm() {
  const authClient = useAuthClient()
  const [step, setStep] = useState<'email' | 'otp'>('email')
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

  const sendCode = async () => {
    const trimmed = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setError('Введите адрес почты.')
      return
    }
    setPending(true)
    setError(null)
    const { error: err } = await authClient.emailOtp.sendVerificationOtp({
      email: trimmed,
      type: 'sign-in',
    })
    setPending(false)
    if (err) {
      setError(describeOtpError(err))
      return
    }
    setEmail(trimmed)
    setOtp('')
    setStep('otp')
    setCooldown(RESEND_COOLDOWN_S)
  }

  const verify = async () => {
    setPending(true)
    setError(null)
    const { error: err } = await authClient.signIn.emailOtp({
      email,
      otp: otp.trim(),
      // Display name for first-time registrations; ignored on sign-in.
      name: email.split('@')[0] ?? '',
    })
    setPending(false)
    if (err) setError(describeOtpError(err))
    // Success: $sessionSignal flips useSession → the gate unmounts this form.
  }

  if (step === 'email') {
    return (
      <form
        className="flex w-full max-w-xs flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void sendCode()
        }}
      >
        <Input
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
          aria-label="Почта"
        />
        <Button type="submit" variant="outline" disabled={pending || !email.trim()}>
          {pending ? 'Отправляем код…' : 'Получить код на почту'}
        </Button>
        {error && <p className="text-destructive text-sm">{error}</p>}
      </form>
    )
  }

  return (
    <form
      className="flex w-full max-w-xs flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        void verify()
      }}
    >
      <p className="text-muted-foreground text-sm">
        Отправили код на <span className="text-foreground font-medium">{email}</span>
      </p>
      <Input
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="6-значный код"
        maxLength={6}
        value={otp}
        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
        disabled={pending}
        aria-label="Код из письма"
        autoFocus
      />
      <Button type="submit" disabled={pending || otp.trim().length < 6}>
        {pending ? 'Проверяем…' : 'Войти'}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <button
          type="button"
          className="hover:text-foreground underline-offset-2 hover:underline"
          onClick={() => {
            setStep('email')
            setError(null)
          }}
        >
          Другая почта
        </button>
        <button
          type="button"
          className="hover:text-foreground underline-offset-2 hover:underline
            disabled:cursor-default disabled:opacity-50 disabled:hover:no-underline"
          disabled={cooldown > 0 || pending}
          onClick={() => void sendCode()}
        >
          {cooldown > 0 ? `Отправить ещё раз (${cooldown}с)` : 'Отправить ещё раз'}
        </button>
      </div>
    </form>
  )
}
