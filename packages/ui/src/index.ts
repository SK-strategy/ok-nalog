import { cx } from 'class-variance-authority'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: Parameters<typeof cx>) => twMerge(cx(inputs))

export * from './avatar'
export * from './button'
export * from './checkbox'
export * from './dropdown-menu'
export * from './input'
export * from './kbd'
export * from './popover'
export * from './scroll-area'
export * from './separator'
export * from './skeleton'
export * from './star-rating'
export * from './table'
