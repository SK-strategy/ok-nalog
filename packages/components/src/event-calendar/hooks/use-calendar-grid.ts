'use client'

import type { Locale } from 'date-fns'
import { useMemo } from 'react'
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns'

import type { CalendarDay } from '../types'

export interface UseCalendarGridOptions {
  currentDate: Date
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

export interface UseCalendarGridReturn {
  days: CalendarDay[]
  weeks: CalendarDay[][]
  weekdays: string[]
}

/**
 * Hook for generating the calendar grid
 * Returns days organized by weeks with event data
 */
export function useCalendarGrid({
  currentDate,
  weekdayLabels,
  locale,
}: UseCalendarGridOptions): UseCalendarGridReturn {
  // Generate all days for the calendar grid
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(monthStart)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const allDays = eachDayOfInterval({
      start: calendarStart,
      end: calendarEnd,
    })

    return allDays.map((date) => {
      return {
        date,
        isCurrentMonth: isSameMonth(date, currentDate),
        isToday: isToday(date),
      }
    })
  }, [currentDate])

  // Organize days into weeks
  const weeks = useMemo(() => {
    const result: CalendarDay[][] = []
    let week: CalendarDay[] = []

    for (let i = 0; i < days.length; i++) {
      const day = days[i]
      if (day) {
        week.push(day)
      }
      if (week.length === 7 || i === days.length - 1) {
        result.push(week)
        week = []
      }
    }

    return result
  }, [days])

  // Generate weekday labels - use provided labels or generate from date-fns
  const weekdays = useMemo(() => {
    if (weekdayLabels?.length === 7) {
      return weekdayLabels
    }

    return Array.from({ length: 7 }).map((_, i) => {
      const date = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i)
      return format(date, 'EEE', locale ? { locale } : undefined)
    })
  }, [weekdayLabels, locale])

  return {
    days,
    weeks,
    weekdays,
  }
}
