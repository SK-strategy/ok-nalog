'use client'

import { useEffect, useRef } from 'react'

import { useTelegramWebApp } from './telegram'

/**
 * Wire the current screen's back action to Telegram's native BackButton.
 *
 * Pass `enabled=false` on the home screen so the chevron disappears when
 * there's nowhere to go back to (Telegram doesn't auto-hide it). The handler
 * is stored in a ref so inline arrow callbacks don't re-register every render
 * — Telegram would otherwise accumulate stale listeners.
 */
export function useBackButton(onClick: () => void, enabled = true): void {
  const wa = useTelegramWebApp()
  const handlerRef = useRef(onClick)
  handlerRef.current = onClick

  useEffect(() => {
    if (!wa) return
    if (!enabled) {
      wa.BackButton.hide()
      return
    }
    const handler = () => handlerRef.current()
    wa.BackButton.onClick(handler)
    wa.BackButton.show()
    return () => {
      wa.BackButton.offClick(handler)
      wa.BackButton.hide()
    }
  }, [wa, enabled])
}
