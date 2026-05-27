'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown } from 'lucide-react'

import type { HomeMode } from '../model/use-home-mode'
import { useHomeMode } from '../model/use-home-mode'

const MODE_LABEL: Record<HomeMode, string> = {
  customer: 'Заказчик',
  executor: 'Эксперт',
  admin: 'Админ',
}

const MODE_HINT: Record<HomeMode, string> = {
  customer: 'Категории и обращения',
  executor: 'Доступные заявки и кабинет',
  admin: 'Все заявки и настройки',
}

// Each mode has a canonical route. The executor cabinet lives at its own
// path so available-pool, claim flow and анкета share a URL; customer and
// admin both render at `/` with mode-dispatched content.
const MODE_ROUTE: Record<HomeMode, string> = {
  customer: '/',
  executor: '/executor',
  admin: '/',
}

/**
 * Header pop-over that flips between role dashboards. Persists the choice
 * via `useHomeMode` and navigates to the canonical route for the picked
 * mode — `/executor` for executors, `/` for customer/admin (whose content
 * is rendered by HomePage's dispatcher).
 *
 *   - `allowed` is the set of modes the current user actually has access
 *     to (e.g. only `customer` for someone who hasn't applied yet). When
 *     it shrinks to a single entry, the switcher renders nothing.
 *   - `current` is the mode the parent considers active right now. It's
 *     used purely for label + selected check; navigation is owned by the
 *     switcher itself.
 */
export function ModeSwitcher({ current, allowed }: { current: HomeMode; allowed: HomeMode[] }) {
  const router = useRouter()
  const [, setMode] = useHomeMode()
  const [open, setOpen] = useState(false)

  if (allowed.length <= 1) return null

  const select = (next: HomeMode) => {
    setMode(next)
    setOpen(false)
    const target = MODE_ROUTE[next]
    // `replace` so the previous dashboard doesn't pile up in the back-stack
    // (the user "switched", they didn't "navigate forward").
    router.replace(target)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="bg-secondary text-foreground flex items-center gap-1 rounded-lg px-2 py-1
          text-[13px] font-semibold"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {MODE_LABEL[current]}
        <ChevronDown className="size-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} role="presentation" />
          <div
            className="border-separator bg-background absolute top-full right-0 z-50 mt-1 w-56
              overflow-hidden rounded-xl border shadow-lg"
            role="menu"
          >
            {allowed.map((m) => (
              <Option
                key={m}
                label={MODE_LABEL[m]}
                hint={MODE_HINT[m]}
                selected={current === m}
                onClick={() => select(m)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Option({
  label,
  hint,
  selected,
  onClick,
}: {
  label: string
  hint: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="menuitem"
      className="active:bg-secondary flex w-full items-start gap-3 px-3 py-2.5 text-left"
    >
      <div className="min-w-0 flex-1">
        <div className="text-foreground text-[14px] leading-tight font-semibold">{label}</div>
        <div className="text-text-soft mt-0.5 text-[12px] leading-tight">{hint}</div>
      </div>
      {selected && <Check className="text-primary mt-0.5 size-4 shrink-0" />}
    </button>
  )
}
