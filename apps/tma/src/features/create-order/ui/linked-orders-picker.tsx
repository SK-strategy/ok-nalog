'use client'

import { useState } from 'react'
import { ChevronDown, History, Link2 } from 'lucide-react'

import type { Id } from '~/shared/api'
import { cn } from '~/shared/lib'

import type { LinkableOrder } from '../model/use-new-question-form'

const dateFmt = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
})

/**
 * "Прикрепить прошлое обращение" — attach one or more of the customer's own
 * closed заявки to the question being written.
 *
 * The expert assigned to the new заявка can then read those threads instead of
 * making the client retell a case the platform already has on record. Collapsed
 * by default: most questions are standalone, and an always-open list of past
 * tickets would bury the actual compose field.
 */
export function LinkedOrdersPicker({
  orders,
  selected,
  onToggle,
  max,
}: {
  orders: LinkableOrder[] | undefined
  selected: Id<'orders'>[]
  onToggle: (id: Id<'orders'>) => void
  max: number
}) {
  const [open, setOpen] = useState(false)

  // Nothing closed yet → nothing to attach. Render nothing rather than an
  // empty affordance the customer can't act on.
  if (orders?.length === 0) return null

  const atCap = selected.length >= max

  return (
    <div className="bg-secondary/60 rounded-2xl border border-transparent">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 p-3.5 text-left"
      >
        <History className="text-hint size-4 shrink-0" />
        <span className="text-foreground flex-1 text-[14px] font-medium">
          Прикрепить прошлое обращение
          {selected.length > 0 && (
            <span className="text-primary font-semibold"> · {selected.length}</span>
          )}
        </span>
        <ChevronDown
          className={cn('text-hint size-4 shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-1.5 px-3 pb-3">
          <p className="text-hint px-1 pb-1 text-[12px] leading-relaxed">
            Эксперт сможет прочитать выбранные обращения вместе с новым — не придётся заново
            описывать историю. Максимум {max}.
          </p>
          {orders === undefined && <p className="text-hint px-1 text-[13px]">Загрузка…</p>}
          {orders?.map((o) => {
            const checked = selected.includes(o._id)
            return (
              <button
                key={o._id}
                type="button"
                onClick={() => onToggle(o._id)}
                disabled={!checked && atCap}
                className={cn(
                  `flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left
                  transition-colors`,
                  checked
                    ? 'border-primary bg-background'
                    : 'bg-background/60 hover:border-separator border-transparent',
                  !checked && atCap && 'cursor-not-allowed opacity-40',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-md border',
                    checked
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-hint/50',
                  )}
                  aria-hidden
                >
                  {checked && <Link2 className="size-2.5" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block truncate text-[13.5px] font-medium">
                    {o.categoryTitle ?? 'Обращение'}
                  </span>
                  <span className="text-hint mt-0.5 line-clamp-2 block text-[12px] leading-snug">
                    {o.description}
                  </span>
                </span>
                <span className="text-hint shrink-0 text-[11px] tabular-nums">
                  {dateFmt.format(new Date(o.createdAt))}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
