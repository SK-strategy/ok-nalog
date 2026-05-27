'use client'

import { AdminGate } from '~/features/auth'
import { CategoryAdmin } from '~/features/category-admin'
import { ExecutorModeration } from '~/features/executor-moderation'
import { AssignQueue, PaymentQueue, ReviewQueue } from '~/features/order-moderation'

export function AdminDashboardPage() {
  return (
    <main className="container mx-auto flex flex-col gap-6 py-8">
      <AdminGate>
        <h1 className="text-2xl font-bold">Панель администратора</h1>
        <div className="grid gap-6 lg:grid-cols-2">
          <ReviewQueue />
          <PaymentQueue />
          <AssignQueue />
          <ExecutorModeration />
          <CategoryAdmin />
        </div>
      </AdminGate>
    </main>
  )
}
