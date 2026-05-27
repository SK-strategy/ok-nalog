'use client'

import { useMemo, useState } from 'react'
import { useQuery } from 'convex/react'
import { Check, Search } from 'lucide-react'

import type { ClientType } from '@tax-assistant/validators'
import { formatKopecks } from '@tax-assistant/validators'

import type { Doc, Id } from '~/shared/api'
import { api } from '~/shared/api'
import { cn } from '~/shared/lib'
import { BottomSheet } from '~/shared/ui/bottom-sheet'

import { categoryStyle } from '../lib/palette'

type Category = Doc<'categories'>

const NBSP = ' '

export function CategorySearchSheet({
  open,
  onClose,
  onSelect,
  clientType,
  selectedId,
  title = 'Категории',
}: {
  open: boolean
  onClose: () => void
  onSelect: (category: Category) => void
  clientType?: ClientType
  selectedId?: Id<'categories'>
  title?: string
}) {
  // The sheet only renders behind <AuthGate> / the customer dashboard;
  // gating the query by `open` is enough — there's no anonymous reader.
  const filtered = useQuery(
    api.categories.listForClientType,
    open && clientType ? { clientType } : 'skip',
  )
  const all = useQuery(api.categories.listActive, open && !clientType ? {} : 'skip')
  const categories = clientType ? filtered : all

  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    if (!categories) return []
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0)
    if (words.length === 0) return categories
    return categories.filter((c) => {
      const haystack = `${c.title} ${c.description} ${c.code ?? ''}`.toLowerCase()
      return words.every((w) => haystack.includes(w))
    })
  }, [categories, query])

  if (!open) return null

  return (
    <BottomSheet
      title={title}
      onClose={() => {
        setQuery('')
        onClose()
      }}
    >
      <div className="bg-background sticky top-0 z-10 px-4 pt-2 pb-3">
        <div className="bg-secondary flex items-center gap-2 rounded-xl px-3 py-2.5">
          <Search className="text-hint size-4 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Например, НДС, отчётность, проверка"
            className="text-foreground placeholder:text-hint w-full bg-transparent text-[15px]
              outline-none"
          />
        </div>
      </div>
      <ul className="flex-1 overflow-y-auto pb-6">
        {categories === undefined &&
          Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="px-4 py-3">
              <div className="bg-secondary h-14 animate-pulse rounded-2xl" />
            </li>
          ))}
        {categories !== undefined && results.length === 0 && (
          <li className="text-hint px-4 py-6 text-center text-sm">Ничего не найдено</li>
        )}
        {results.map((c, i) => {
          const palette = categoryStyle(c.sortOrder)
          const Icon = palette.icon
          const isSelected = selectedId === c._id
          return (
            <li key={c._id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(c)
                  setQuery('')
                  onClose()
                }}
                className={cn(
                  'hover:bg-secondary/60 relative flex w-full items-start gap-3 px-4 py-3 text-left',
                  i > 0 &&
                    `before:bg-separator before:absolute before:top-0 before:right-0
                    before:left-[64px] before:h-px before:content-[""]`,
                )}
              >
                <div
                  className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[10px]"
                  style={{ background: palette.bg, color: palette.fg }}
                >
                  <Icon className="size-5" strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-foreground text-[15px] leading-snug font-semibold">
                    {c.title}
                  </div>
                  {c.description && (
                    <div className="text-text-soft mt-0.5 line-clamp-2 text-[13px] leading-snug">
                      {c.description}
                    </div>
                  )}
                  <div className="text-hint mt-1 text-[12px]">
                    от{NBSP}
                    {formatKopecks(c.basePrice)}
                  </div>
                </div>
                {isSelected && (
                  <Check className="text-primary size-[18px] shrink-0 translate-y-1.5" />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </BottomSheet>
  )
}
