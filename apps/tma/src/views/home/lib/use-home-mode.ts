'use client'

import { useEffect, useState } from 'react'

export type HomeMode = 'customer' | 'executor' | 'admin'

const STORAGE_KEY = 'tma:homeMode'

const isHomeMode = (v: string | null): v is HomeMode =>
  v === 'customer' || v === 'executor' || v === 'admin'

/**
 * Persisted home-view preference. Returns `null` until the user explicitly
 * picks a mode — the caller resolves the default from role (executors land
 * on their dashboard, everyone else on the catalogue). Storing only the
 * explicit choice means a revoked executor naturally falls back to customer
 * view without us having to migrate stale localStorage entries.
 */
export function useHomeMode(): readonly [HomeMode | null, (v: HomeMode) => void] {
  const [value, setValue] = useState<HomeMode | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(STORAGE_KEY)
    // One-shot read from localStorage on mount — same pattern as useClientType.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isHomeMode(stored)) setValue(stored)
  }, [])

  const update = (next: HomeMode) => {
    setValue(next)
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, next)
  }

  return [value, update] as const
}
