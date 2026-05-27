'use client'

import { Skeleton } from '@tax-assistant/ui'

import { useSession } from '~/entities/session'

import { TelegramLoginButton } from './telegram-login-button'

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
        <p className="text-muted-foreground text-sm">Войдите через Telegram.</p>
        <TelegramLoginButton />
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
