'use client'

import { useEffect, useState } from 'react'

import type { ClientType } from '@tax-assistant/validators'
import { CLIENT_TYPES } from '@tax-assistant/validators'

const STORAGE_KEY = 'app:clientType'

const isClientType = (v: string | null): v is ClientType =>
  v !== null && (CLIENT_TYPES as readonly string[]).includes(v)

/**
 * Persisted client-type selection. Starts as `legal_entity_ie` until the user
 * picks something else. Reads/writes localStorage so the choice survives
 * navigation and tab restarts.
 */
export function useClientType(): readonly [ClientType, (v: ClientType) => void] {
  const [value, setValue] = useState<ClientType>('legal_entity_ie')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(STORAGE_KEY)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isClientType(stored)) setValue(stored)
  }, [])

  const update = (next: ClientType) => {
    setValue(next)
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, next)
  }

  return [value, update] as const
}
