'use client'

import { useQuery } from 'convex/react'

import { api } from '~/shared/api'

import type { NavItem } from './nav'

export interface NavBadge {
  count: number
  /** Human-readable "why is this red", surfaced as the link's tooltip. */
  reason: string
}

/**
 * Live counts behind the red sidebar badges.
 *
 * The admin's whole job is reacting to things that are waiting — a заявка
 * nobody priced, an expert whose dialog is sitting in review, an анкета nobody
 * approved. Without a badge, spotting those means opening each page and
 * looking, so work quietly ages. Shared by the desktop sidebar and the mobile
 * bar so the two can't drift apart.
 */
export function useNavBadges(): (item: NavItem) => NavBadge | undefined {
  const pendingExecutors = useQuery(api.executors.pendingCount, {})
  const pendingChanges = useQuery(api.executors.pendingChangesCount, {})
  const orders = useQuery(api.orders.attentionCounts, {})

  const executorsCount = (pendingExecutors ?? 0) + (pendingChanges ?? 0)

  return (item: NavItem): NavBadge | undefined => {
    if (item.badgeKey === 'executorsPending') {
      if (executorsCount === 0) return undefined
      const parts: string[] = []
      if (pendingExecutors) parts.push(`новых анкет: ${pendingExecutors}`)
      if (pendingChanges) parts.push(`изменений на проверке: ${pendingChanges}`)
      return { count: executorsCount, reason: parts.join(' · ') }
    }
    if (item.badgeKey === 'ordersAttention') {
      if (!orders || orders.total === 0) return undefined
      // Name each bucket by the action it needs, so the tooltip tells the admin
      // what to do rather than just restating the status.
      const parts: string[] = []
      if (orders.pricing) parts.push(`оценить: ${orders.pricing}`)
      if (orders.assignment) parts.push(`назначить эксперта: ${orders.assignment}`)
      if (orders.review) parts.push(`проверить ответ: ${orders.review}`)
      if (orders.expired) parts.push(`оплата просрочена: ${orders.expired}`)
      return { count: orders.total, reason: parts.join(' · ') }
    }
    return undefined
  }
}
