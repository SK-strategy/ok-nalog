'use client'

import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'

import { Command, CommandInput, CommandItem, CommandList } from '@tax-assistant/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@tax-assistant/ui/popover'

import { cn } from '~/shared/lib'

interface ComboboxProps<T> {
  /** The field/button that opens the dropdown. Becomes the popover anchor. */
  trigger: ReactNode
  /** `undefined` renders the loading skeleton (e.g. a Convex query in flight). */
  items: T[] | undefined
  selectedKey?: string
  onSelect: (item: T) => void
  getKey: (item: T) => string
  /** Text matched against the query (space-separated AND of substrings). */
  getSearchText: (item: T) => string
  renderItem: (item: T, selected: boolean) => ReactNode
  searchPlaceholder?: string
  emptyText?: string
  align?: 'start' | 'center' | 'end'
  /** Extra classes for the popover panel (e.g. a wider min-width). */
  contentClassName?: string
  /** Optional controlled open state (lets the caller gate data fetching). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Web-native combobox: a search-as-you-type dropdown anchored to its trigger,
 * with full keyboard navigation (↑/↓ to move, Enter to pick, Esc to close).
 * This is the shadcn Popover + cmdk Command pattern, replacing the mobile
 * bottom-sheet pickers the web app inherited from the TMA.
 *
 * Filtering is done here (predictable substring AND-match that preserves the
 * server's ordering) rather than via cmdk's fuzzy scorer, so `shouldFilter` is
 * off and the empty/loading states are rendered explicitly.
 */
export function Combobox<T>({
  trigger,
  items,
  selectedKey,
  onSelect,
  getKey,
  getSearchText,
  renderItem,
  searchPlaceholder = 'Поиск',
  emptyText = 'Ничего не найдено',
  align = 'start',
  contentClassName,
  open: controlledOpen,
  onOpenChange,
}: ComboboxProps<T>) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [query, setQuery] = useState('')

  const open = controlledOpen ?? internalOpen
  const setOpen = (next: boolean) => {
    onOpenChange?.(next)
    if (controlledOpen === undefined) setInternalOpen(next)
    if (!next) setQuery('')
  }

  const results = useMemo(() => {
    if (!items) return []
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0)
    if (words.length === 0) return items
    return items.filter((item) => {
      const haystack = getSearchText(item).toLowerCase()
      return words.every((w) => haystack.includes(w))
    })
  }, [items, query, getSearchText])

  const loading = items === undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={6}
        className={cn(
          `flex max-h-[min(60vh,var(--radix-popover-content-available-height))]
          w-(--radix-popover-trigger-width) flex-col overflow-hidden p-0`,
          contentClassName,
        )}
      >
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder={searchPlaceholder} />
          <CommandList className="max-h-none">
            {loading ? (
              <div className="flex flex-col gap-1 p-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="bg-secondary h-12 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="text-hint px-4 py-8 text-center text-sm">{emptyText}</div>
            ) : (
              <div className="p-1.5">
                {results.map((item) => {
                  const key = getKey(item)
                  return (
                    <CommandItem
                      key={key}
                      value={key}
                      onSelect={() => {
                        onSelect(item)
                        setOpen(false)
                      }}
                      className="cursor-pointer items-start gap-3 px-2.5 py-2.5"
                    >
                      {renderItem(item, selectedKey === key)}
                    </CommandItem>
                  )
                })}
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
