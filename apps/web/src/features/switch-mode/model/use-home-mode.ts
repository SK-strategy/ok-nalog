'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

export type HomeMode = 'customer' | 'executor'

const STORAGE_KEY = 'app:homeMode'

const isHomeMode = (v: string | null): v is HomeMode => v === 'customer' || v === 'executor'

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
 * Persisted dashboard-mode preference. Shared across every consumer in the
 * tree so a `setMode` from the header switcher propagates to every reader
 * (the executor-cabinet's own back-link, etc.) without a round-trip through
 * routing.
 */
export function useHomeMode(): readonly [HomeMode | null, (v: HomeMode) => void, boolean] {
  if (typeof window !== 'undefined') readFromStorage()

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true)
  }, [])

  return [value, writeMode, hydrated] as const
}
