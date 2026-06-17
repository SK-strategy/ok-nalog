'use client'

import { useState } from 'react'
import { AtSign, MailCheck } from 'lucide-react'

import { useLinkEmail } from '../model/use-link-email'
import { LinkEmailSheet } from './link-email-sheet'

/**
 * Dashboard entry point for attaching an email to the current account (so a
 * Telegram-logged-in user can also sign in by email, one unified profile).
 * Self-hides nothing — always offers add/change; mirrors the web
 * LinkTelegramCard idiom.
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
        className="bg-card hover:bg-secondary/40 flex items-center gap-3 rounded-2xl border p-4
          text-left transition-colors"
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
            {linked ?? 'Вход по коду из письма — с этим же аккаунтом и вашими обращениями.'}
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
