import type { ReactNode } from 'react'

import { cn } from '@tax-assistant/ui'

/**
 * Wrapper that lifts the first/last table cells to `pl-6` / `pr-6` so they
 * align with the page header text. The Table primitive renders edge-to-edge
 * inside it.
 */
export function DataTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        `w-full [&_td:first-child]:pl-6 [&_td:last-child]:pr-6 [&_th:first-child]:pl-6
        [&_th:last-child]:pr-6`,
        className,
      )}
    >
      {children}
    </div>
  )
}
