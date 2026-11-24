'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'

import { Button } from '@tax-assistant/ui/button'

import { cn } from '~/shared/lib'

/**
 * Landing-only header navigation (pathname === '/'). Anchor links to the
 * page sections + the «Загрузить документ» CTA. On mobile the links collapse
 * into a burger (this dropdown), per brief §4. Product routes keep the
 * original header — this component is only rendered on '/'.
 */
export const LANDING_LINKS = [
  { href: '#how', label: 'Как это работает' },
  { href: '#experts', label: 'Наши эксперты' },
  { href: '#situations', label: 'Тематики' },
  { href: '#faq', label: 'Вопросы' },
] as const

// Landing CTA copy — duplicated from views/marketing/model/content (widgets
// may not import from views; keep the two in sync).
const CTA_LABEL = 'Загрузить документ'

export function LandingNav({ isAuthed }: { isAuthed: boolean }) {
  return (
    <>
      {LANDING_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-text-soft hover:text-foreground text-sm font-medium transition-colors"
        >
          {link.label}
        </Link>
      ))}
      {isAuthed && (
        <Link
          href="/profile"
          className="text-text-soft hover:text-foreground text-sm font-medium transition-colors"
        >
          Профиль
        </Link>
      )}
      <Button asChild size="sm">
        <Link href="/orders">{CTA_LABEL}</Link>
      </Button>
    </>
  )
}

export function LandingBurger({ isAuthed }: { isAuthed: boolean }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on click outside / escape so the dropdown behaves like a menu.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Меню"
        className="bg-secondary text-foreground hover:bg-secondary/80 focus-visible:ring-ring/50
          flex size-9 items-center justify-center rounded-lg transition-colors outline-none
          focus-visible:ring-[3px]"
      >
        <Menu className="size-4" />
      </button>

      {open && (
        <div
          className="border-separator bg-background absolute top-full right-0 z-50 mt-1.5 w-64
            overflow-hidden rounded-xl border shadow-lg"
          role="menu"
        >
          <div className="flex flex-col py-1">
            {LANDING_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={cn(
                  'text-foreground hover:bg-secondary px-4 py-2.5 text-[14px] font-medium',
                )}
              >
                {link.label}
              </Link>
            ))}
            {isAuthed && (
              <Link
                href="/profile"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="text-foreground hover:bg-secondary px-4 py-2.5 text-[14px] font-medium"
              >
                Профиль
              </Link>
            )}
          </div>
          <div className="border-separator/60 border-t px-3 py-2.5">
            <Button asChild className="w-full" size="sm">
              <Link href="/orders" onClick={() => setOpen(false)}>
                {CTA_LABEL}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
