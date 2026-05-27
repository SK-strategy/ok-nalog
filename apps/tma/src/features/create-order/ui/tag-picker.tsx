'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'

import type { Doc, Id } from '~/shared/api'
import { cn } from '~/shared/lib'
import { BottomSheet } from '~/shared/ui/bottom-sheet'

type Tag = Doc<'tags'>

/**
 * Searchable tag picker — opens a full-height bottom sheet with a filter
 * input so the customer can find a specific topic out of dozens. Kept as a
 * single-component sheet (no Radix) because the TMA viewport is narrow and
 * a popover would clip; the sheet uses the same shape as native iOS pickers.
 */
export function TagPicker({
  tags,
  value,
  onChange,
  placeholder = 'Выберите тему',
  loading,
  disabled,
}: {
  tags: Tag[] | undefined
  value: Id<'tags'> | undefined
  onChange: (id: Id<'tags'> | undefined) => void
  placeholder?: string
  loading?: boolean
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selected = useMemo(() => tags?.find((t) => t._id === value), [tags, value])

  const filtered = useMemo(() => {
    if (!tags) return []
    const q = query.trim().toLowerCase()
    if (!q) return tags
    return tags.filter((t) => t.name.toLowerCase().includes(q))
  }, [tags, query])

  const inert = Boolean(loading) || Boolean(disabled)

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!inert) setOpen(true)
        }}
        className={cn(
          'bg-secondary flex w-full items-center gap-2.5 rounded-2xl p-3.5 text-left',
          'transition-opacity active:opacity-80 disabled:opacity-55',
        )}
        disabled={inert}
      >
        <div className="min-w-0 flex-1">
          {selected ? (
            <div className="text-foreground truncate text-[15px] font-semibold">
              {selected.name}
            </div>
          ) : (
            <span className="text-hint text-[15px]">{loading ? 'Загрузка…' : placeholder}</span>
          )}
        </div>
        <ChevronDown className="text-hint size-4 shrink-0" />
      </button>

      {open && (
        <BottomSheet onClose={() => setOpen(false)} title="Тема обращения">
          <div className="bg-background sticky top-0 z-10 px-4 pt-2 pb-3">
            <div className="bg-secondary flex items-center gap-2 rounded-xl px-3 py-2.5">
              <Search className="text-hint size-4 shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по темам"
                className="text-foreground placeholder:text-hint w-full bg-transparent text-[15px]
                  outline-none"
              />
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto pb-6">
            {filtered.length === 0 && (
              <li className="text-hint px-4 py-6 text-center text-sm">Ничего не найдено</li>
            )}
            {filtered.map((t, i) => (
              <li key={t._id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(t._id)
                    setOpen(false)
                    setQuery('')
                  }}
                  className={cn(
                    `active:bg-secondary/60 relative flex w-full items-start gap-3 px-4 py-3
                    text-left`,
                    i > 0 &&
                      `before:bg-separator before:absolute before:top-0 before:right-0 before:left-4
                      before:h-px before:content-[""]`,
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-foreground text-[15px] leading-snug font-medium">
                      {t.name}
                    </div>
                  </div>
                  {value === t._id && (
                    <Check className="text-primary size-[18px] shrink-0 translate-y-0.5" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </BottomSheet>
      )}
    </>
  )
}
