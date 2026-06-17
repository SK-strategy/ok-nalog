'use client'

import { useState } from 'react'
import { AtSign, MailCheck } from 'lucide-react'

import { useLinkEmail } from '../model/use-link-email'
import { LinkEmailSheet } from './link-email-sheet'

/**
 * Home-screen entry point for linking an email to the Telegram account so the
 * same профиль works on the web app via email-OTP login. Mirrors the
 * BecomeExecutorCard visual idiom.
 */
export function LinkEmailCard() {
  const form = useLinkEmail()
  const [open, setOpen] = useState(false)

  if (form.isLoading) return null

  const linked = form.linkedEmail

  const close = () => {
    setOpen(false)
    form.reset()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-card flex items-center gap-3 rounded-2xl p-4 text-left transition-opacity
          active:opacity-80"
      >
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-[10px] ${
            linked ? 'bg-status-done-bg text-status-done' : 'bg-primary-soft text-primary' }`}
        >
          {linked ? (
            <MailCheck className="size-5" strokeWidth={1.8} />
          ) : (
            <AtSign className="size-5" strokeWidth={1.8} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-[14px] font-semibold">
            {linked ? 'Почта привязана' : 'Привязать почту'}
          </p>
          <p className="text-text-soft mt-0.5 truncate text-[12px] leading-snug">
            {linked ?? 'Чтобы входить в веб-версию по коду из письма.'}
          </p>
        </div>
        <span className="text-primary shrink-0 text-[13px] font-semibold">
          {linked ? 'Изменить' : 'Привязать'}
        </span>
      </button>

      {open && <LinkEmailSheet form={form} onClose={close} />}
    </>
  )
}
