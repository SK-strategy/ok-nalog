'use client'

import { Suspense } from 'react'

import { NewOrderPage } from '~/views/new-order'

// Wrapped in Suspense because NewOrderPage reads `?categoryId` via
// useSearchParams, which suspends on Next 15+ during initial static render.
export default function Route() {
  return (
    <Suspense fallback={null}>
      <NewOrderPage />
    </Suspense>
  )
}
