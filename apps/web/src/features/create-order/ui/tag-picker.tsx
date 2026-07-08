'use client'

import { useMemo } from 'react'
import { Check, ChevronDown } from 'lucide-react'

import type { Doc, Id } from '~/shared/api'
import { cn } from '~/shared/lib'
import { Combobox } from '~/shared/ui/combobox'

type Tag = Doc<'tags'>

/**
 * Searchable tag picker — a web-native combobox: clicking the field drops a
 * search-as-you-type list right below it (keyboard navigable), instead of the
 * mobile bottom sheet the web app inherited from the TMA.
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
  const selected = useMemo(() => tags?.find((t) => t._id === value), [tags, value])
  const inert = Boolean(loading) || Boolean(disabled)

  return (
    <Combobox
      items={tags}
      selectedKey={value}
      onSelect={(t) => onChange(t._id)}
      getKey={(t) => t._id}
      getSearchText={(t) => t.name}
      searchPlaceholder="Поиск по темам"
      renderItem={(t, isSelected) => (
        <>
          <span className="text-foreground min-w-0 flex-1 text-[15px] font-medium">{t.name}</span>
          {isSelected && <Check className="text-primary size-[18px] shrink-0" />}
        </>
      )}
      trigger={
        <button
          type="button"
          disabled={inert}
          className={cn(
            `group bg-secondary flex w-full items-center gap-2.5 rounded-2xl border
            border-transparent p-3.5 text-left transition-colors disabled:opacity-55`,
            'data-[state=open]:border-primary data-[state=open]:bg-background',
          )}
        >
          <span className="min-w-0 flex-1">
            {selected ? (
              <span className="text-foreground block truncate text-[15px] font-semibold">
                {selected.name}
              </span>
            ) : (
              <span className="text-hint text-[15px]">{loading ? 'Загрузка…' : placeholder}</span>
            )}
          </span>
          <ChevronDown
            className="text-hint size-4 shrink-0 transition-transform
              group-data-[state=open]:rotate-180"
          />
        </button>
      }
    />
  )
}
