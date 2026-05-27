'use client'

import type { ReactNode } from 'react'

import { AdminGate } from '~/features/auth'

import { MobileBar } from './mobile-bar'
import { Sidebar } from './sidebar'

/**
 * Outer chrome for every admin route: gates on the admin role, then renders
 * the persistent left rail next to the page body. The signed-out / not-admin
 * states fall back to `AdminGate`'s own empty layout.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AdminGate>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileBar />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </AdminGate>
  )
}
