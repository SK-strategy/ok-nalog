'use client'

import type { ReactNode } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@tax-assistant/ui/dialog'

import { cn } from '~/shared/lib'

/**
 * Web-native centered modal. Built on the shared Radix Dialog, so it gets a
 * focus trap, scroll lock, Escape-to-close, a portal and the right ARIA wiring
 * for free — none of which the old hand-rolled mobile BottomSheet had.
 *
 * It deliberately reads as a desktop dialog rather than a phone sheet: a
 * centered card that zooms in, with an ✕ close affordance (top-right) instead
 * of the iOS-style «Готово». On narrow viewports it falls back to a near
 * full-width card (standard responsive-web behaviour).
 *
 * Body padding and scroll are the caller's responsibility so forms can pin a
 * footer — the content area is a flex column capped at the viewport height.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent
        // Radix warns when a dialog has no description; we intentionally omit
        // one for most sheets, so opt out of the auto-association explicitly.
        {...(description ? {} : { 'aria-describedby': undefined })}
        className={cn(
          `flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 shadow-xl
          sm:max-w-[480px]`,
          className,
        )}
      >
        <DialogHeader className="shrink-0 px-5 pt-5 pr-12 pb-3 text-left">
          <DialogTitle
            className="text-foreground text-[17px] leading-tight font-bold tracking-tight"
          >
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="text-text-soft text-sm leading-relaxed">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
