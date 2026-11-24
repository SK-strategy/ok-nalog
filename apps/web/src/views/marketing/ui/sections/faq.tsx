'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '~/shared/lib'

import { FAQ } from '../../model/content'

/**
 * Section 12 — FAQ accordion. Client island: single-open items, full keyboard
 * support via native buttons, aria-expanded/aria-controls wired (brief §12).
 */
export function Faq() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section id="faq" className="scroll-mt-20">
      <h2 className="text-foreground mb-6 text-center text-2xl font-bold tracking-tight">
        Вопросы
      </h2>
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        {FAQ.map((item, i) => {
          const isOpen = open === i
          const buttonId = `faq-button-${i}`
          const panelId = `faq-panel-${i}`
          return (
            <div key={item.q} className="bg-card rounded-2xl border">
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <span className="text-foreground text-[15px] leading-snug font-semibold">
                  {item.q}
                </span>
                <ChevronDown
                  className={cn(
                    'text-hint size-4 shrink-0 transition-transform',
                    isOpen && 'rotate-180',
                  )}
                />
              </button>
              {isOpen && (
                <div id={panelId} role="region" aria-labelledby={buttonId} className="px-5 pb-4">
                  <p className="text-text-soft text-sm leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
