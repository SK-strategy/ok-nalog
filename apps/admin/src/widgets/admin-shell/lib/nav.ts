import type { ComponentType } from 'react'
import { ClipboardList, FolderTree, LayoutDashboard, Users, UserSquare2 } from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  /** When set, the sidebar shows a badge with the live value (e.g. pending executors). */
  badgeKey?: 'executorsPending'
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Обзор', icon: LayoutDashboard },
  { href: '/orders', label: 'Заявки', icon: ClipboardList },
  { href: '/users', label: 'Пользователи', icon: Users },
  { href: '/executors', label: 'Исполнители', icon: UserSquare2, badgeKey: 'executorsPending' },
  { href: '/categories', label: 'Категории', icon: FolderTree },
] as const

/**
 * Match a nav item to a pathname. "/" matches only itself, every other entry
 * matches its own prefix so nested routes (e.g. /executors/[id]) keep the
 * parent link highlighted.
 */
export function isNavActive(itemHref: string, pathname: string): boolean {
  if (itemHref === '/') return pathname === '/'
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`)
}
