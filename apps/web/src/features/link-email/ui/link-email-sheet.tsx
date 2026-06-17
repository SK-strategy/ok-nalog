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
 * Two-step sheet: адрес → код из письма → готово, with a «объединить» fallback
 * when the email already belongs to a separate account. All state lives in
 * `useLinkEmail`; this layer only renders the controller. Mirrors the TMA slice.
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
              Укажите почту — отправим на неё 6-значный код. После подтверждения сможете входить по
              этой почте, а ваши обращения останутся в одном профиле.
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
              {form.mode === 'merge' ? 'Код для объединения отправлен на ' : 'Отправили код на '}
              <span className="text-foreground font-medium">{form.email}</span>
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
              {form.pending
                ? 'Проверяем…'
                : form.mode === 'merge'
                  ? 'Подтвердить и объединить'
                  : 'Подтвердить'}
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
            {form.mode === 'change' && (
              <button
                type="button"
                disabled={form.pending}
                onClick={() => void form.startMerge()}
                className="text-primary text-left text-xs leading-relaxed disabled:opacity-50"
              >
                Код не приходит? Возможно, на эту почту уже есть аккаунт — объединить с текущим.
              </button>
            )}
          </>
        )}

        {form.step === 'done' && (
          <>
            <p className="text-foreground text-sm leading-relaxed">
              {form.mode === 'merge' ? (
                <>
                  Готово — аккаунт с почтой <span className="font-medium">{form.email}</span>{' '}
                  объединён с текущим. Все обращения теперь в одном профиле.
                </>
              ) : (
                <>
                  Готово — почта <span className="font-medium">{form.email}</span> привязана.
                </>
              )}
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
