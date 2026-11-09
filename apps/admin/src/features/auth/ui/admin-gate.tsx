'use client'

import { Skeleton } from '@tax-assistant/ui'

import { useSession } from '~/entities/session'

import { EmailOtpForm } from './email-otp-form'

// Telegram sign-in is switched off for now (login is by email code only).
// import { TelegramLoginButton } from './telegram-login-button'

/** Renders children only for a signed-in user with the admin role. */
export function AdminGate({ children }: { children: React.ReactNode }) {
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
        <h2 className="text-2xl font-semibold">Панель администратора</h2>
        <p className="text-muted-foreground text-sm">Войдите по коду из письма.</p>
        {/* Telegram sign-in is switched off for now:
        <TelegramLoginButton />
        <div className="flex w-full max-w-xs items-center gap-3">
          <div className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-xs uppercase">или</span>
          <div className="bg-border h-px flex-1" />
        </div>
        */}
        <EmailOtpForm />
      </div>
    )
  }

  if (me.user.role !== 'admin') {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-2 py-16 text-center">
        <h2 className="text-xl font-semibold">Доступ запрещён</h2>
        <p className="text-muted-foreground text-sm">
          Этот раздел доступен только администраторам.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
