'use client'

import { Skeleton } from '@tax-assistant/ui'

import { useSession } from '~/entities/session'

import { EmailOtpForm } from './email-otp-form'
import { TelegramLoginButton } from './telegram-login-button'

/** Renders children only for a signed-in user; otherwise prompts to log in. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { me, isLoading } = useSession()

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3 py-16">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!me) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <h2 className="text-2xl font-semibold">Вход в личный кабинет</h2>
        <p className="text-muted-foreground text-sm">
          Войдите через Telegram или получите код на почту.
        </p>
        <TelegramLoginButton />
        <div className="flex w-full max-w-xs items-center gap-3">
          <div className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-xs uppercase">или</span>
          <div className="bg-border h-px flex-1" />
        </div>
        <EmailOtpForm />
      </div>
    )
  }

  return <>{children}</>
}
