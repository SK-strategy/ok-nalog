'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown } from 'lucide-react'

import type { HomeMode } from '../model/use-home-mode'
import { useHomeMode } from '../model/use-home-mode'

const MODE_LABEL: Record<HomeMode, string> = {
  customer: 'Заказчик',
  executor: 'Эксперт',
}

const MODE_HINT: Record<HomeMode, string> = {
  customer: 'Категории и обращения',
  executor: 'Доступные заявки и кабинет',
}

const MODE_ROUTE: Record<HomeMode, string> = {
  customer: '/orders',
  executor: '/executor',
}

/**
 * Header pop-over that flips between role dashboards (customer dashboard vs
 * executor cabinet). Persists the choice via `useHomeMode` and navigates to
 * the canonical route for the picked mode.
 *
 * When `allowed.length <= 1` the switcher renders nothing — a customer with
 * no executor profile sees no UI cruft.
 */
export function ModeSwitcher({ current, allowed }: { current: HomeMode; allowed: HomeMode[] }) {
  const router = useRouter()
  const [, setMode] = useHomeMode()
  const [open, setOpen] = useState(false)

  if (allowed.length <= 1) return null

  const select = (next: HomeMode) => {
    setMode(next)
    setOpen(false)
    router.push(MODE_ROUTE[next])
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
      className="hover:bg-secondary flex w-full items-start gap-3 px-3 py-2.5 text-left"
    >
      <div className="min-w-0 flex-1">
        <div className="text-foreground text-[14px] leading-tight font-semibold">{label}</div>
        <div className="text-text-soft mt-0.5 text-[12px] leading-tight">{hint}</div>
      </div>
      {selected && <Check className="text-primary mt-0.5 size-4 shrink-0" />}
    </button>
  )
}
