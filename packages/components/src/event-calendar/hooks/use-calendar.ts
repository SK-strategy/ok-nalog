'use client'

import { useCallback, useState } from 'react'
import { addMonths, endOfMonth, startOfMonth, subMonths } from 'date-fns'

export interface UseCalendarOptions {
  initialInterval?: {
    startDate: Date
    endDate: Date
  } | null
}

export function useCalendar({ initialInterval }: UseCalendarOptions = {}) {
  const [currentInterval, setCurrentInterval] = useState(
    initialInterval ?? {
      startDate: startOfMonth(new Date()),
      endDate: endOfMonth(new Date()),
    },
  )

  const goToNext = useCallback(() => {
    setCurrentInterval(({ startDate, endDate }) => ({
      startDate: startOfMonth(addMonths(startDate, 1)),
      endDate: endOfMonth(addMonths(endDate, 1)),
    }))
  }, [])

  const goToPrevious = useCallback(() => {
    setCurrentInterval(({ startDate, endDate }) => ({
      startDate: startOfMonth(subMonths(startDate, 1)),
      endDate: endOfMonth(subMonths(endDate, 1)),
    }))
  }, [])

  const goToToday = useCallback(() => {
    setCurrentInterval({
      startDate: startOfMonth(new Date()),
      endDate: endOfMonth(new Date()),
    })
  }, [])

  return {
    currentInterval,
    goToNext,
    goToPrevious,
    goToToday,
    setCurrentInterval,
  }
}
