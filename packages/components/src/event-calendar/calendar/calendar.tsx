'use client'

import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import type { ReactNode } from 'react'
import { createContext, useContext, useId, useState } from 'react'
import {
  DndContext,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'

import { cn } from '@fedor/ui'

import { EventGap, EventHeight } from '../constants'

export interface CalendarContextValue {
  currentDate: Date
}

const CalendarContext = createContext<CalendarContextValue | null>(null)

export function useCalendarContext() {
  const context = useContext(CalendarContext)
  if (!context) {
    throw new Error('Calendar components must be used within Calendar')
  }
  return context
}

export interface CalendarProps {
  currentDate: Date

  children: ReactNode
  className?: string
}

export function Calendar({
  currentDate,

  children,
  className,
}: CalendarProps) {
  const [_activeId, setActiveId] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [_eventHeight, setEventHeight] = useState<number | null>(null)

  const dndContextId = useId()

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    if (!active.data.current) return

    setActiveId(active.id as string)
  }

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  )

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    if (!over?.data.current) return

    const { date } = over.data.current as { date: Date }
    const newTime = new Date(date)

    // Preserve original time of day
    if (currentTime) {
      newTime.setHours(
        currentTime.getHours(),
        currentTime.getMinutes(),
        currentTime.getSeconds(),
        currentTime.getMilliseconds(),
      )
    }

    // Only update if date changed
    if (
      !currentTime ||
      newTime.getDate() !== currentTime.getDate() ||
      newTime.getMonth() !== currentTime.getMonth() ||
      newTime.getFullYear() !== currentTime.getFullYear()
    ) {
      setCurrentTime(newTime)
    }
  }

  const handleDragEndInternal = (_event: DragEndEvent) => {
    // TODO: when event data is wired up, persist the dropped event's new
    // date here using `_event.over.data.current.date` and `currentTime`.
    setActiveId(null)
    setCurrentTime(null)
    setEventHeight(null)
  }

  return (
    <CalendarContext.Provider
      value={{
        currentDate,
      }}
    >
      <DndContext
        id={dndContextId}
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEndInternal}
      >
        <div
          style={
            {
              '--event-height': `${EventHeight}px`,
              '--event-gap': `${EventGap}px`,
            } as React.CSSProperties
          }
          className={cn('rounded-lg border', className)}
        >
          {children}
        </div>
      </DndContext>
    </CalendarContext.Provider>
  )
}
