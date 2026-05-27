'use client'

import type { ComponentPropsWithRef, ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { format } from 'date-fns'

import { cn } from '@tax-assistant/ui'

import type { CalendarDay as CalendarDayType } from '../types'

export interface CalendarDayProps extends ComponentPropsWithRef<'div'> {
  day: CalendarDayType
  header?: ReactNode
}

export const CalendarDay = ({ day, children, className, header, ...props }: CalendarDayProps) => {
  const cellId = `calendar-day-${day.date.toISOString()}`

  const { setNodeRef } = useDroppable({
    id: cellId,
    data: {
      date: day.date,
    },
  })

  return (
    <div
      key={day.date.toString()}
      ref={setNodeRef}
      className={cn(
        `group border-border/70 flex flex-col overflow-hidden border-r border-b px-0.5 py-1
        last:border-r-0 sm:px-1`,
        'data-today:bg-accent/5',
        'data-outside-cell:bg-muted/15 data-outside-cell:text-muted-foreground/70',
        'data-dragging:bg-accent',
        className,
      )}
      data-today={day.isToday || undefined}
      data-outside-cell={!day.isCurrentMonth || undefined}
      {...props}
    >
      <div className="flex items-center gap-1 pt-1">
        <div
          className="group-data-today:bg-primary group-data-today:text-primary-foreground
            inline-flex size-6 shrink-0 items-center justify-center rounded-full text-sm"
        >
          {format(day.date, 'd')}
        </div>
        {header}
      </div>

      <div
        className={cn(
          'flex flex-col',
          `min-h-[calc((var(--event-height)+var(--event-gap))*2)] flex-col
          sm:min-h-[calc((var(--event-height)+var(--event-gap))*3)]
          lg:min-h-[calc((var(--event-height)+var(--event-gap))*4)]`,
        )}
      >
        {children}
      </div>
    </div>
  )
}
