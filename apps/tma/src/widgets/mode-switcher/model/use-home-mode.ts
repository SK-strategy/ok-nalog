'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

export type HomeMode = 'customer' | 'executor' | 'admin'

const STORAGE_KEY = 'tma:homeMode'

const isHomeMode = (v: string | null): v is HomeMode =>
  v === 'customer' || v === 'executor' || v === 'admin'

// Module-scope store. Multiple useHomeMode consumers (the switcher in the
// cabinet header, the dispatcher in HomePage, the BecomeExecutorCard's
// status check, …) MUST see the same value. Without this, the switcher's
// `setMode` updates only its own useState copy and the others miss it —
// which is fine when the route also changes (the destination remounts and
// re-reads localStorage), but silently broken when the route stays the
// same. That's exactly the admin↔customer case: both modes render at `/`,
// so `router.replace('/')` is a no-op, and AdminHome never gets the memo
// that the user picked Заказчик.
let cached: HomeMode | null = null
let storageRead = false
const listeners = new Set<() => void>()

function readFromStorage(): void {
  if (storageRead || typeof window === 'undefined') return
  const stored = window.localStorage.getItem(STORAGE_KEY)
  cached = isHomeMode(stored) ? stored : null
  storageRead = true
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function getSnapshot(): HomeMode | null {
  return cached
}

function getServerSnapshot(): HomeMode | null {
  return null
}

function writeMode(next: HomeMode): void {
  cached = next
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, next)
  for (const l of listeners) l()
}

/**
 * Persisted dashboard-mode preference, shared across every consumer in
 * the tree.
 *
 *   - `value` (1st slot): the picked mode, or `null` until the user
 *     explicitly picks one. The role-based default lives at the call site.
 *   - `setMode` (2nd slot): writes through to localStorage and broadcasts
 *     to every subscribed consumer so same-URL switches (admin↔customer
 *     at `/`) actually flip the dashboard.
 *   - `hydrated` (3rd slot): `true` once the consumer has committed at
 *     least once on the client. Routing side-effects must gate on it —
 *     the first render uses the server snapshot (`null`), and acting on
 *     it would race the persisted preference and bounce the user back
 *     after every switch.
 */
export function useHomeMode(): readonly [HomeMode | null, (v: HomeMode) => void, boolean] {
  // Populate `cached` before useSyncExternalStore samples so the
  // post-hydration snapshot already reflects localStorage.
  if (typeof window !== 'undefined') readFromStorage()

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    // Flip from false→true after first client commit — used by routing
    // effects elsewhere to wait until the persisted preference is reflected
    // in the snapshot before reacting.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true)
  }, [])

  return [value, writeMode, hydrated] as const
}
