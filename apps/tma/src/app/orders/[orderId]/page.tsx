'use client'

import { useParams } from 'next/navigation'

import { OrderDetailPage } from '~/views/order-detail'
import type { Id } from '~/shared/api'

export default function Route() {
  const params = useParams<{ orderId: string }>()
  return <OrderDetailPage orderId={params.orderId as Id<'orders'>} />
}
