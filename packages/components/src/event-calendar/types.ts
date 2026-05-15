export type EventColor = 'sky' | 'amber' | 'violet' | 'rose' | 'emerald' | 'orange'

export interface CalendarDay {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
}
