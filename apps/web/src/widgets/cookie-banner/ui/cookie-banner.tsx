'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'cookie-consent'
type Consent = 'all' | 'necessary'

/**
 * Bottom cookie-consent bar (not a modal). Choice persists in localStorage;
 * once stored, the bar never renders again. No focus trap and no autofocus —
 * the tab order just reaches it after the page content.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Deferred so the check never runs as a synchronous setState in the effect
    // body (react-hooks/set-state-in-effect).
    const id = window.setTimeout(() => {
      try {
        if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
      } catch {
        // localStorage unavailable (private mode) — show the bar every time.
        setVisible(true)
      }
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

  if (!visible) return null

  const choose = (consent: Consent) => {
    try {
      localStorage.setItem(STORAGE_KEY, consent)
    } catch {
      // ignore — the bar hides for this session only
    }
    setVisible(false)
  }

  return (
    <div
      role="region"
      aria-label="Уведомление о cookie"
      className="bg-card border-separator fixed inset-x-0 bottom-0 z-50 border-t"
    >
      <div
        className="mx-auto flex max-w-5xl flex-col gap-1.5 px-4 py-2 sm:flex-row sm:items-center
          sm:justify-between sm:gap-6 sm:px-6"
      >
        <p className="text-text-soft text-[12px] leading-snug">
          Мы используем cookie: необходимые — для входа и оплаты, остальные — для аналитики.{' '}
          <Link
            href="/cookie"
            className="text-foreground focus-visible:ring-ring/50 rounded-sm underline
              underline-offset-2 outline-none focus-visible:ring-[3px]"
          >
            Подробнее
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose('necessary')}
            className="text-text-soft hover:text-foreground border-separator-strong
              focus-visible:ring-ring/50 rounded-lg border px-3 py-1.5 text-[12px] font-medium
              whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px]"
          >
            Только необходимые
          </button>
          <button
            type="button"
            onClick={() => choose('all')}
            className="bg-primary text-primary-foreground hover:bg-primary/90
              focus-visible:ring-ring/50 rounded-lg px-3 py-1.5 text-[12px] font-medium
              whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px]"
          >
            Принять
          </button>
        </div>
      </div>
    </div>
  )
}
