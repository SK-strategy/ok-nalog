import type { HomeMode } from './use-home-mode'

// Single source of truth for mode display + routing. Shared by the desktop
// dropdown switcher and the mobile menu rows in `widgets/site-header` so
// they stay in lockstep — adding a new role here surfaces it everywhere.
export const MODE_LABEL: Record<HomeMode, string> = {
  customer: 'Заказчик',
  executor: 'Эксперт',
}

export const MODE_HINT: Record<HomeMode, string> = {
  customer: 'Категории и обращения',
  executor: 'Доступные заявки и кабинет',
}

export const MODE_ROUTE: Record<HomeMode, string> = {
  customer: '/orders',
  executor: '/executor',
}
