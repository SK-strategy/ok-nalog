'use client'

import type { ReactNode } from 'react'
import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { cn } from '~/shared/lib'

import type { MainButtonConfig } from '../lib/use-main-button'
import { useTelegramWebApp } from '../lib/telegram'
import { useBackButton } from '../lib/use-back-button'
import { useMainButton } from '../lib/use-main-button'

export interface TmaScreenProps {
  title?: ReactNode
  subtitle?: ReactNode
  /** `true` (default) wires native BackButton to router.back(); `false` hides
   *  it (home); pass a function to override the destination. */
  back?: boolean | (() => void)
  rightAction?: ReactNode
  mainButton?: MainButtonConfig
  /** Extra classes for the scrolling body. */
  bodyClassName?: string
  children: ReactNode
}

/**
 * The single chrome wrapper every TMA route renders inside. Owns:
 *  - the title bar (centered title + optional subtitle/action)
 *  - the scrolling body
 *  - Telegram's native BackButton + MainButton wiring
 *  - a browser-fallback ← chevron and bottom button bar so the app is also
 *    usable outside Telegram during development
 */
export function TmaScreen({
  title,
  subtitle,
  back = true,
  rightAction,
  mainButton,
  bodyClassName,
  children,
}: TmaScreenProps) {
  const router = useRouter()
  const wa = useTelegramWebApp()

  const handleBack = useCallback(() => {
    if (typeof back === 'function') back()
    else router.back()
  }, [back, router])

  useBackButton(handleBack, back !== false)
  useMainButton(mainButton)

  const inTelegram = wa !== null
  const showInPageBack = back !== false && !inTelegram
  const showInPageMainButton = !!mainButton && !inTelegram
  const hasHeader = !!title || !!subtitle || showInPageBack || !!rightAction

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      {hasHeader && (
        <Header
          title={title}
          subtitle={subtitle}
          rightAction={rightAction}
          showBack={showInPageBack}
          onBack={handleBack}
        />
      )}

      <div
        className={cn('flex-1 overflow-y-auto', showInPageMainButton && 'pb-[66px]', bodyClassName)}
      >
        {children}
      </div>

      {showInPageMainButton && <FallbackMainButton mainButton={mainButton} />}
    </div>
  )
}

// ─── header (in-page; Telegram has its own chrome above the WebView) ─────
function Header({
  title,
  subtitle,
  rightAction,
  showBack,
  onBack,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  rightAction?: ReactNode
  showBack: boolean
  onBack: () => void
}) {
  return (
    <header className="border-separator bg-background sticky top-0 z-20 flex h-11 items-center px-4">
      {showBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-primary -ml-2 flex items-center gap-1 p-2"
          aria-label="Назад"
        >
          <ChevronLeft className="size-5" />
          <span className="text-base font-medium">Назад</span>
        </button>
      )}

      {(title || subtitle) && (
        <div
          className="pointer-events-none absolute top-1/2 left-1/2 max-w-[60vw] -translate-x-1/2
            -translate-y-1/2 text-center"
        >
          {title && (
            <div
              className="text-foreground truncate text-base leading-tight font-bold tracking-tight"
            >
              {title}
            </div>
          )}
          {subtitle && (
            <div className="text-hint truncate text-xs leading-tight font-medium">{subtitle}</div>
          )}
        </div>
      )}

      {rightAction && <div className="text-primary ml-auto flex items-center">{rightAction}</div>}
    </header>
  )
}

// ─── browser-fallback MainButton bar ─────────────────────────────────────
function FallbackMainButton({ mainButton }: { mainButton: MainButtonConfig }) {
  const isInactive = mainButton.disabled || mainButton.loading
  return (
    <button
      type="button"
      onClick={mainButton.onClick}
      disabled={isInactive}
      className={cn(
        `bg-primary text-primary-foreground fixed inset-x-0 bottom-0 z-30 flex h-[50px] items-center
        justify-center gap-2 text-base font-bold tracking-tight transition-opacity
        active:opacity-90`,
        isInactive && 'cursor-not-allowed opacity-55',
      )}
    >
      {mainButton.loading && (
        <span
          className="absolute inset-0 animate-pulse bg-gradient-to-r from-white/20 to-transparent"
        />
      )}
      <span className="relative">{mainButton.text}</span>
    </button>
  )
}
