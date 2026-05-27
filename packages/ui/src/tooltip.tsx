'use client'

import type { FC } from 'react'
import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

import { cn } from '@tax-assistant/ui'

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip: FC<
  TooltipPrimitive.TooltipProps & TooltipPrimitive.TooltipProviderProps & { disabled?: boolean }
> = ({
  delayDuration = 100,
  skipDelayDuration = 300,
  disableHoverableContent = false,
  ...props
}) => {
  return (
    <TooltipProvider
      delayDuration={delayDuration}
      disableHoverableContent={disableHoverableContent}
      skipDelayDuration={skipDelayDuration}
    >
      <TooltipPrimitive.Root {...props} />
    </TooltipProvider>
  )
}

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & {
    portalProps?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Portal>
  }
>(({ className, sideOffset = 4, portalProps, ...props }, ref) => (
  <TooltipPrimitive.Portal {...portalProps}>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        `bg-primary text-primary-foreground animate-in fade-in-0 zoom-in-95
        data-[state=closed]:animate-out data-[state=closed]:fade-out-0
        data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2
        data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2
        data-[side=top]:slide-in-from-bottom-2 z-50 overflow-hidden rounded-md px-3 py-1.5 text-xs`,
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
