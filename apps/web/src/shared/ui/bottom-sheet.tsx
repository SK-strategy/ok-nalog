'use client'

import type { ReactNode } from 'react'
import { useEffect } from 'react'

import { cn } from '~/shared/lib'

/**
 * Lightweight bottom sheet shared by tag/category pickers and the executor
 * profile editor. Plain DOM (no Radix) so it never clips against narrow
 * viewports. Closes on backdrop click or Escape; locks body scroll while open.
 *
 * On larger viewports the sheet caps at 480px and is centered horizontally so
 * it reads as a centered modal instead of a stretched-edge bar.
 */
export function BottomSheet({
  title,
  onClose,
  children,
  className,
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/30"
      onClick={onClose}
      role="presentation"
    >
      <div className="flex-1" />
      <div
        className={cn(
          `bg-background mx-auto flex max-h-[90dvh] w-full flex-col rounded-t-3xl sm:my-auto
          sm:max-w-[520px] sm:rounded-3xl`,
          className,
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex h-12 shrink-0 items-center justify-between px-4">
          <div className="text-foreground text-base font-bold tracking-tight">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="text-primary p-1 text-base font-medium"
          >
            Готово
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  )
}
