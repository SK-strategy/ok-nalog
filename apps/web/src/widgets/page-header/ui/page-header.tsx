'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

/**
 * In-page header used by inner screens (orders list, new order, order detail,
 * executor cabinet). Sits below the site-wide `SiteHeader` and provides the
 * page title + optional back-chevron and right-side action slot — matching
 * the structure of the TMA's `TmaScreen` header without depending on
 * Telegram's BackButton.
 *
 *  - `back` undefined (default): no back link.
 *  - `back === true`: chevron that calls router.back().
 *  - `back === string`: chevron that navigates to a fixed href (preferred —
 *    survives entering the page via a deep link / direct URL).
 *  - `back === fn`: chevron that calls the function.
 */
export function PageHeader({
  title,
  subtitle,
  back,
  rightAction,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  back?: true | string | (() => void)
  rightAction?: ReactNode
}) {
  const router = useRouter()
  const showBack = back !== undefined
  const onBack = () => {
    if (typeof back === 'function') back()
    else if (typeof back === 'string') router.push(back)
    else router.back()
  }

  return (
    <header
      className="border-separator/60 bg-background/95 supports-[backdrop-filter]:bg-background/80
        sticky top-14 z-10 grid h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b
        px-4 backdrop-blur"
    >
      <div className="flex items-center">
        {showBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-primary -ml-2 flex items-center gap-1 p-2"
            aria-label="Назад"
          >
            <ChevronLeft className="size-5" />
            <span className="hidden text-base font-medium sm:inline">Назад</span>
          </button>
        )}
      </div>

      <div className="min-w-0 text-center">
        {title && (
          <div className="text-foreground truncate text-base leading-tight font-bold tracking-tight">
            {title}
          </div>
        )}
        {subtitle && (
          <div className="text-hint truncate text-xs leading-tight font-medium">{subtitle}</div>
        )}
      </div>

      <div className="text-primary flex items-center justify-end">{rightAction}</div>
    </header>
  )
}
