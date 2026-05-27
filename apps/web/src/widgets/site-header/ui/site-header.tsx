'use client'

import Link from 'next/link'

import { SignOutButton, TelegramLoginButton } from '~/features/auth'
import { useSession } from '~/entities/session'

export function SiteHeader() {
  const { me } = useSession()

  return (
    <header className="border-b">
      <div className="container mx-auto flex h-14 items-center justify-between">
        <Link href="/" className="font-semibold">
          Налоговый помощник
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {me ? (
            <>
              <Link href="/orders" className="hover:underline">
                Мои заявки
              </Link>
              <Link href="/cabinet" className="hover:underline">
                Кабинет исполнителя
              </Link>
              <span className="text-muted-foreground hidden sm:inline">
                {me.user.name ?? me.user.telegramUsername ?? ''}
              </span>
              <SignOutButton />
            </>
          ) : (
            <TelegramLoginButton />
          )}
        </nav>
      </div>
    </header>
  )
}
