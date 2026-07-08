'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { useQuery } from 'convex/react'
import { Check } from 'lucide-react'

import type { ClientType } from '@tax-assistant/validators'
import { formatKopecks } from '@tax-assistant/validators'

import type { Doc, Id } from '~/shared/api'
import { api } from '~/shared/api'
import { cn } from '~/shared/lib'
import { Combobox } from '~/shared/ui/combobox'

import { categoryStyle } from '../lib/palette'

type Category = Doc<'categories'>

const NBSP = ' '

/**
 * Category picker — a web-native combobox anchored to `trigger` (a category
 * field, or the dashboard's search icon). The list query is gated on `open`,
 * so opening the dropdown is what fetches the categories.
 */
export function CategorySearchSheet({
  trigger,
  onSelect,
  clientType,
  selectedId,
  align = 'start',
  contentClassName,
}: {
  trigger: ReactNode
  onSelect: (category: Category) => void
  clientType?: ClientType
  selectedId?: Id<'categories'>
  align?: 'start' | 'center' | 'end'
  contentClassName?: string
}) {
  const [open, setOpen] = useState(false)

  // Gated by `open` — no anonymous reader, the picker only renders behind the
  // customer dashboard / <AuthGate>.
  const filtered = useQuery(
    api.categories.listForClientType,
    open && clientType ? { clientType } : 'skip',
  )
  const all = useQuery(api.categories.listActive, open && !clientType ? {} : 'skip')
  const categories = clientType ? filtered : all

  return (
    <Combobox
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      items={categories}
      selectedKey={selectedId}
      onSelect={onSelect}
      getKey={(c) => c._id}
      getSearchText={(c) => `${c.title} ${c.description} ${c.code ?? ''}`}
      searchPlaceholder="Например, НДС, отчётность, проверка"
      align={align}
      contentClassName={cn('min-w-[min(24rem,calc(100vw-2rem))]', contentClassName)}
      renderItem={(c, isSelected) => <CategoryRow category={c} selected={isSelected} />}
    />
  )
}

function CategoryRow({ category, selected }: { category: Category; selected: boolean }) {
  const palette = categoryStyle(category.sortOrder)
  const Icon = palette.icon
  return (
    <>
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: palette.bg, color: palette.fg }}
      >
        <Icon className="size-5" strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-foreground text-[15px] leading-snug font-semibold">
          {category.title}
        </div>
        {category.description && (
          <div className="text-text-soft mt-0.5 line-clamp-2 text-[13px] leading-snug">
            {category.description}
          </div>
        )}
        <div className="text-hint mt-1 text-[12px]">
          от{NBSP}
          {formatKopecks(category.basePrice)}
        </div>
      </div>
      {selected && <Check className="text-primary mt-0.5 size-[18px] shrink-0" />}
    </>
  )
}
