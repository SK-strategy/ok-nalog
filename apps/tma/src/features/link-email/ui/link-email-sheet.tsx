'use client'

import { Button } from '@tax-assistant/ui/button'

import { cn } from '~/shared/lib'
import { BottomSheet } from '~/shared/ui/bottom-sheet'

import type { LinkEmailController } from '../model/use-link-email'

const inputClass = cn(
  'bg-secondary text-foreground placeholder:text-hint w-full rounded-2xl border',
  'focus:bg-background border-transparent p-3.5 text-[15px] outline-none',
  'focus:border-primary',
)

/**
 * Two-step bottom sheet: адрес → код из письма → готово. All state lives in
 * `useLinkEmail`; this layer only renders the controller (house pattern, see
 * executor-application).
 */
export function LinkEmailSheet({
  form,
  onClose,
}: {
  form: LinkEmailController
  onClose: () => void
}) {
  return (
    <BottomSheet title={form.linkedEmail ? 'Сменить почту' : 'Привязать почту'} onClose={onClose}>
      <div className="flex flex-col gap-4 px-4 pt-2 pb-6">
        {form.step === 'email' && (
          <>
            <p className="text-text-soft text-sm leading-relaxed">
              Укажите почту — отправим на неё 6-значный код. После подтверждения сможете входить в
              веб-версию по этой почте, без Telegram.
            </p>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => form.setEmail(e.target.value)}
              disabled={form.pending}
              className={inputClass}
            />
            {form.error && <p className="text-destructive text-sm">{form.error}</p>}
            <Button
              className="w-full"
              disabled={form.pending || !form.email.trim()}
              onClick={() => void form.requestCode()}
            >
              {form.pending ? 'Отправляем…' : 'Получить код'}
            </Button>
          </>
        )}

        {form.step === 'otp' && (
          <>
            <p className="text-text-soft text-sm leading-relaxed">
              Отправили код на <span className="text-foreground font-medium">{form.email}</span>
            </p>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-значный код"
              maxLength={6}
              value={form.otp}
              onChange={(e) => form.setOtp(e.target.value.replace(/\D/g, ''))}
              disabled={form.pending}
              className={inputClass}
              autoFocus
            />
            {form.error && <p className="text-destructive text-sm">{form.error}</p>}
            <Button
              className="w-full"
              disabled={form.pending || form.otp.trim().length < 6}
              onClick={() => void form.confirm()}
            >
              {form.pending ? 'Проверяем…' : 'Подтвердить'}
            </Button>
            <div className="text-hint flex items-center justify-between text-xs">
              <button type="button" className="p-1" onClick={form.reset}>
                Другая почта
              </button>
              <button
                type="button"
                className="p-1 disabled:opacity-50"
                disabled={form.cooldown > 0 || form.pending}
                onClick={() => void form.requestCode()}
              >
                {form.cooldown > 0 ? `Отправить ещё раз (${form.cooldown}с)` : 'Отправить ещё раз'}
              </button>
            </div>
            <p className="text-hint text-xs leading-relaxed">
              Код не приходит? Проверьте «Спам». Если письма всё нет — возможно, эта почта уже
              привязана к другому аккаунту.
            </p>
          </>
        )}

        {form.step === 'done' && (
          <>
            <p className="text-foreground text-sm leading-relaxed">
              Готово — почта <span className="font-medium">{form.email}</span> привязана. Теперь по
              ней можно входить в веб-версию: запросите код на странице входа.
            </p>
            <Button className="w-full" onClick={onClose}>
              Понятно
            </Button>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
