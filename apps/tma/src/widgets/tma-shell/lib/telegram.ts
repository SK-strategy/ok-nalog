'use client'

import { useEffect, useState } from 'react'

// Typed surface for the parts of the Telegram WebApp API we drive. The runtime
// object is injected by `https://telegram.org/js/telegram-web-app.js`
// (loaded `beforeInteractive` in the root layout) before any of our hooks run.
// Outside Telegram (dev browser, server) it's absent — every consumer treats
// that as "use the in-page fallback chrome".

export interface TelegramBackButton {
  isVisible: boolean
  show(): void
  hide(): void
  onClick(cb: () => void): void
  offClick(cb: () => void): void
}

export interface TelegramMainButton {
  text: string
  isVisible: boolean
  isActive: boolean
  isProgressVisible: boolean
  setText(text: string): TelegramMainButton
  show(): void
  hide(): void
  enable(): void
  disable(): void
  showProgress(leaveActive?: boolean): void
  hideProgress(): void
  onClick(cb: () => void): void
  offClick(cb: () => void): void
}

export interface TelegramWebApp {
  initData: string
  platform: string
  colorScheme: 'light' | 'dark'
  themeParams: Record<string, string>
  ready(): void
  expand(): void
  BackButton: TelegramBackButton
  MainButton: TelegramMainButton
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

/**
 * Sync getter. Returns `null` on the server or when the page isn't running
 * inside Telegram — `initData` is the canonical "we're in Telegram" signal
 * (the script defines `window.Telegram.WebApp` even outside Telegram, but
 * `initData` stays empty there).
 */
export function getTelegramApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null
  const wa = window.Telegram?.WebApp
  if (!wa?.initData) return null
  return wa
}

/**
 * Hook variant. Renders `null` on the server + first client paint, then
 * re-renders once with the resolved WebApp. The single-step transition avoids
 * hydration mismatch warnings on SSR-rendered pages.
 */
export function useTelegramWebApp(): TelegramWebApp | null {
  const [wa, setWa] = useState<TelegramWebApp | null>(null)
  useEffect(() => {
    setWa(getTelegramApp())
  }, [])
  return wa
}
