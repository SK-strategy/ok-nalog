'use client'

import type { ReactNode } from 'react'
import { Check, Send } from 'lucide-react'

import { TmaScreen } from '~/widgets/tma-shell'
import { LinkEmailCard } from '~/features/link-email'
import { useSession } from '~/entities/session'
import { UserAvatar } from '~/shared/ui/user-avatar'

const ROLE_LABEL: Record<'customer' | 'executor' | 'admin', string> = {
  customer: 'Заказчик',
  executor: 'Эксперт',
  admin: 'Админ',
}

/**
 * /profile — account & identity settings, moved off the home screen. Shows the
 * user's profile (avatar, name, Telegram) and the ways to sign in: Telegram
 * (always present in the Mini App) + email (link/change via LinkEmailCard).
 * One unified профиль regardless of which method is used.
 */
export function ProfilePage() {
  const { me, isLoading } = useSession()

  return (
    <TmaScreen title="Профиль">
      {isLoading || !me ? (
        <div className="flex flex-col items-center gap-4 px-4 pt-8">
          <div className="bg-secondary size-20 animate-pulse rounded-full" />
          <div className="bg-secondary h-5 w-40 animate-pulse rounded-lg" />
          <div className="bg-secondary mt-4 h-16 w-full animate-pulse rounded-2xl" />
        </div>
      ) : (
        <div className="flex flex-col gap-6 pt-4 pb-8">
          {/* ── identity header ── */}
          <section className="flex flex-col items-center gap-3 px-4">
            <UserAvatar src={me.user.image} name={me.user.name} className="size-20 text-2xl" />
            <div className="text-center">
              <div className="text-foreground text-lg leading-tight font-bold">{me.user.name}</div>
              {me.user.telegramUsername && (
                <div className="text-hint mt-0.5 text-sm">@{me.user.telegramUsername}</div>
              )}
            </div>
            <span
              className="bg-secondary text-text-soft rounded-full px-2.5 py-0.5 text-xs
                font-semibold"
            >
              {ROLE_LABEL[me.user.role]}
            </span>
          </section>

          {/* ── ways to sign in ── */}
          <section className="flex flex-col gap-2">
            <h2 className="text-hint mb-1 px-5 text-[12px] font-bold tracking-[0.06em] uppercase">
              Способы входа
            </h2>
            <div className="flex flex-col gap-2 px-4">
              {/* Telegram is always connected inside the Mini App. */}
              <Row
                icon={<Send className="size-5" strokeWidth={1.8} />}
                tone="primary"
                title="Telegram"
                subtitle={me.user.telegramUsername ? `@${me.user.telegramUsername}` : 'Подключён'}
                trailing={<Check className="text-status-done size-5" strokeWidth={2.2} />}
              />
              <LinkEmailCard />
            </div>
            <p className="text-hint px-5 pt-1 text-[12px] leading-relaxed">
              Привяжите почту, чтобы входить в веб-версию по коду из письма — это тот же аккаунт и
              те же обращения.
            </p>
          </section>
        </div>
      )}
    </TmaScreen>
  )
}

// Static settings row, visually matching LinkEmailCard's card idiom.
function Row({
  icon,
  tone,
  title,
  subtitle,
  trailing,
}: {
  icon: ReactNode
  tone: 'primary' | 'done'
  title: string
  subtitle: string
  trailing?: ReactNode
}) {
  return (
    <div className="bg-card flex items-center gap-3 rounded-2xl p-4">
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-[10px] ${
          tone === 'done' ? 'bg-status-done-bg text-status-done' : 'bg-primary-soft text-primary' }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-[14px] font-semibold">{title}</p>
        <p className="text-text-soft mt-0.5 truncate text-[12px] leading-snug">{subtitle}</p>
      </div>
      {trailing}
    </div>
  )
}
