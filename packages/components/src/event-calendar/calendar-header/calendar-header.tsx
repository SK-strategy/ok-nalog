'use client'

import type { Locale } from 'date-fns'
import { format, isSameMonth } from 'date-fns'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { cn } from '@tax-assistant/ui'
import { Button } from '@tax-assistant/ui/button'

export interface CalendarHeaderProps {
  currentDate: Date
  onPrevious: () => void
  onNext: () => void
  onToday?: () => void
  className?: string
  children?: React.ReactNode
  /**
   * Custom label for the "Today" button
   * @default "Today"
   */
  todayLabel?: string
  /**
   * Aria label for previous month button
   * @default "Previous month"
   */
  previousMonthLabel?: string
  /**
   * Aria label for next month button
   * @default "Next month"
   */
  nextMonthLabel?: string
  /**
   * Custom month names for localization. Array of 12 month names starting from January.
   * If provided, takes precedence over the date-fns locale fallback.
   */
  monthNames?: string[]
  /**
   * date-fns locale used when formatting the month title via `format()`.
   * Ignored when `monthNames` is supplied.
   */
  locale?: Locale
}

export function CalendarHeader({
  currentDate,
  onPrevious,
  onNext,
  onToday,
  className,
  children,
  todayLabel = 'Today',
  previousMonthLabel = 'Previous month',
  nextMonthLabel = 'Next month',
  monthNames,
  locale,
}: CalendarHeaderProps) {
  // Get month display text
  const getMonthDisplay = () => {
    if (monthNames?.length === 12) {
      const monthIndex = currentDate.getMonth()
      const year = currentDate.getFullYear()
      return `${monthNames[monthIndex]} ${year}`
    }
    return format(currentDate, 'MMMM yyyy', locale ? { locale } : undefined)
  }

  return (
    <div className={cn('flex items-center justify-between p-2 sm:p-4', className)}>
      <div className="flex items-center gap-1 sm:gap-4">
        <div className="flex items-center sm:gap-2">
          <Button variant="ghost" size="icon" onClick={onPrevious} aria-label={previousMonthLabel}>
            <ChevronLeftIcon size={16} aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onNext} aria-label={nextMonthLabel}>
            <ChevronRightIcon size={16} aria-hidden="true" />
          </Button>
        </div>
        <h2 className="text-sm font-semibold sm:text-lg md:text-xl">{getMonthDisplay()}</h2>
        {onToday && !isSameMonth(new Date(), currentDate) && (
          <Button
            variant="outline"
            className="max-[479px]:aspect-square max-[479px]:p-0!"
            onClick={onToday}
          >
            <span className="max-[479px]:sr-only">{todayLabel}</span>
          </Button>
        )}
      </div>
      {children}
    </div>
  )
}
