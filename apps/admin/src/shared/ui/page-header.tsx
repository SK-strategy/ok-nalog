import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  /** Optional secondary row rendered below the title (tabs, filters, …). */
  footer?: ReactNode
}

/**
 * Top strip of every admin route. Self-padded so pages can stack it directly
 * inside a full-bleed flex column. Children align with the table's first
 * column at `pl-6`.
 */
export function PageHeader({ title, description, actions, footer }: PageHeaderProps) {
  return (
    <header className="border-b">
      <div className="flex flex-wrap items-end justify-between gap-4 px-6 pt-6 pb-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {footer && <div className="px-6 pb-3">{footer}</div>}
    </header>
  )
}
