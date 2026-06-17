'use client'

import { Check, Send } from 'lucide-react'

import { AuthGate, SignOutButton } from '~/features/auth'
import { LinkEmailCard } from '~/features/link-email'
import { LinkTelegramCard } from '~/features/link-telegram'
import { useSession } from '~/entities/session'
import { UserAvatar } from '~/shared/ui/user-avatar'

const ROLE_LABEL: Record<'customer' | 'executor' | 'admin', string> = {
  customer: 'Заказчик',
  executor: 'Эксперт',
  admin: 'Админ',
}

/**
 * /profile — account & identity settings, moved off the dashboard. Shows the
 * user's profile and the ways to sign in: email (link/change) + Telegram
 * (link, or a connected badge once attached). One unified профиль whichever
 * method is used. LinkEmailCard / LinkTelegramCard self-hide the directions
 * that don't apply (a Telegram-linked account hides «Привязать Telegram»).
 */
export function ProfilePage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 pt-6 pb-12 sm:px-6">
      <AuthGate>
        <ProfileBody />
      </AuthGate>
    </main>
  )
}

function ProfileBody() {
  const { me } = useSession()
  if (!me) return null

  const hasTelegram = !!me.user.telegramId

  return (
    <>
      {/* ── identity header ── */}
      <section className="flex flex-col items-center gap-3 pt-2">
        <UserAvatar src={me.user.image} name={me.user.name} className="size-20 text-2xl" />
        <div className="text-center">
          <h1 className="text-foreground text-xl leading-tight font-bold">{me.user.name}</h1>
          {me.user.email && <p className="text-text-soft mt-0.5 text-sm">{me.user.email}</p>}
        </div>
        <span
          className="bg-secondary text-text-soft rounded-full px-2.5 py-0.5 text-xs font-semibold"
        >
          {ROLE_LABEL[me.user.role]}
        </span>
      </section>

      {/* ── ways to sign in ── */}
      <section className="flex flex-col gap-2">
        <h2 className="text-text-soft mb-1 text-xs font-bold tracking-[0.06em] uppercase">
          Способы входа
        </h2>
        <LinkEmailCard />
        {hasTelegram ? (
          <div className="bg-card flex items-center gap-3 rounded-2xl border p-4">
            <div
              className="bg-primary-soft text-primary flex size-10 shrink-0 items-center
                justify-center rounded-[10px]"
            >
              <Send className="size-5" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-foreground text-[14px] font-semibold">Telegram</p>
              <p className="text-text-soft mt-0.5 truncate text-[12px] leading-snug">
                {me.user.telegramUsername ? `@${me.user.telegramUsername}` : 'Подключён'}
              </p>
            </div>
            <Check className="text-status-done size-5" strokeWidth={2.2} />
          </div>
        ) : (
          <LinkTelegramCard />
        )}
        <p className="text-text-soft pt-1 text-xs leading-relaxed">
          Привязанные почта и Telegram — это один и тот же аккаунт с общими обращениями.
        </p>
      </section>

      <div className="border-separator border-t pt-5">
        <SignOutButton />
      </div>
    </>
  )
}
