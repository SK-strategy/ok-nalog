import type { ComponentProps, ReactNode } from 'react'
import { Fragment } from 'react'

import { cn } from '@fedor/ui'

const DefaultKbdSeparator = ({ className, children = '+', ...props }: ComponentProps<'span'>) => (
  <span className={cn('text-muted-foreground/50', className)} {...props}>
    {children}
  </span>
)

export interface KbdProps extends ComponentProps<'span'> {
  separator?: ReactNode
}

export const Kbd = ({
  className,
  separator = <DefaultKbdSeparator />,
  children,
  ...props
}: KbdProps) => (
  <span
    className={cn(
      `bg-muted text-muted-foreground inline-flex items-center gap-1 rounded border px-1.5
      align-middle font-mono text-[10px] leading-loose font-medium select-none`,
      className,
    )}
    {...props}
  >
    {Array.isArray(children)
      ? children.map((child, index) => (
          <Fragment key={index}>
            {child}
            {index < children.length - 1 && separator}
          </Fragment>
        ))
      : children}
  </span>
)

export interface KbdKeyProps extends Omit<ComponentProps<'kbd'>, 'aria-label'> {
  'aria-label'?: string
}

export const KbdKey = ({ className, ...props }: KbdKeyProps) => (
  <kbd className={className} {...props} />
)
