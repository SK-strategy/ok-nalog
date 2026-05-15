'use client'

import type { VariantProps } from 'class-variance-authority'
import * as React from 'react'
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import { cva } from 'class-variance-authority'

import { cn } from '@fedor/ui'

const toggleGroupVariants = cva(
  'bg-muted text-muted-foreground inline-flex items-center justify-center rounded-lg p-1',
  {
    variants: {
      variant: {
        default: 'bg-muted',
        outline: 'border-input border bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

const toggleGroupItemVariants = cva(
  `ring-offset-background focus-visible:ring-ring data-[state=on]:bg-background
  data-[state=on]:text-foreground inline-flex items-center justify-center rounded-md px-3 py-1
  text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2
  focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none
  disabled:opacity-50 data-[state=on]:shadow`,
  {
    variants: {
      variant: {
        default: 'hover:bg-background/50 hover:text-foreground',
        outline: `hover:bg-accent hover:text-accent-foreground data-[state=on]:border-input border
        border-transparent`,
      },
      size: {
        default: 'h-9 px-3',
        sm: 'h-7 px-2 text-xs',
        lg: 'h-10 px-4',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

const ToggleGroupContext = React.createContext<VariantProps<typeof toggleGroupItemVariants>>({
  variant: 'default',
  size: 'default',
})

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> &
    VariantProps<typeof toggleGroupVariants> &
    VariantProps<typeof toggleGroupItemVariants>
>(({ className, variant, size, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn(toggleGroupVariants({ variant }), className)}
    {...props}
  >
    <ToggleGroupContext.Provider value={{ variant, size }}>{children}</ToggleGroupContext.Provider>
  </ToggleGroupPrimitive.Root>
))

ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
    VariantProps<typeof toggleGroupItemVariants>
>(({ className, children, variant, size, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext)

  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        toggleGroupItemVariants({
          variant: variant ?? context.variant,
          size: size ?? context.size,
        }),
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
})

ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName

export { ToggleGroup, ToggleGroupItem }
