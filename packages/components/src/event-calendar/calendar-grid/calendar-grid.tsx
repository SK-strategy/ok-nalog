'use client'

import type { Locale } from 'date-fns'
import type { ReactNode } from 'react'

import { cn } from '@tax-assistant/ui'

import type { CalendarDay as CalendarDayType } from '../types'
import { useCalendarContext } from '../calendar'
import { useCalendarGrid } from '../hooks/use-calendar-grid'

export interface CalendarGridProps {
  children?: ReactNode | ((day: CalendarDayType) => ReactNode)
  className?: string
  /**
   * Custom weekday labels. If provided, takes precedence over the date-fns fallback.
   * Should be an array of 7 strings starting from Monday.
   * @example ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
   */
  weekdayLabels?: string[]
  /**
   * date-fns locale used when generating weekday names via `format()`.
   * Ignored when `weekdayLabels` is supplied.
   */
  locale?: Locale
}

export function CalendarGrid({ children, className, weekdayLabels, locale }: CalendarGridProps) {
  const { currentDate } = useCalendarContext()
  const { weeks, weekdays } = useCalendarGrid({
    currentDate,
    weekdayLabels,
    locale,
  })

  return (
    <div className={cn('flex flex-1 flex-col', className)}>
      {/* Weekday headers */}
      <div className="border-border/70 bg-background sticky top-0 grid grid-cols-7 border-b">
        {weekdays.map((day, index) => (
          <div
            key={`${day}-${index}`}
            className={cn(
              'text-muted-foreground/70 py-2 text-center text-sm',
              // (index === 5 || index === 6) && "bg-muted/30",
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid flex-1 auto-rows-fr">
        {weeks.map((week, weekIndex) => (
          <div key={`week-${weekIndex}`} className="grid grid-cols-7 [&:last-child>*]:border-b-0">
            {week.map((day) => {
              if (typeof children === 'function') {
                return children(day)
              }
              return children
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
