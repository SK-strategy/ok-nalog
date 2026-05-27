'use client'

import { useCallback, useMemo, useState } from 'react'

export type SortDir = 'asc' | 'desc'

type Comparable = string | number | null | undefined

interface UseSortResult<T, K extends string> {
  sorted: T[]
  active: K
  dir: SortDir
  toggle: (column: K) => void
  isActive: (column: K) => boolean
}

/**
 * Generic client-side multi-column sort hook. `accessors` map column keys
 * to value extractors; clicking the same column flips direction.
 */
export function useSort<T, K extends string>(
  rows: T[] | undefined,
  accessors: Record<K, (row: T) => Comparable>,
  initial: { column: K; dir?: SortDir },
): UseSortResult<T, K> {
  const [active, setActive] = useState<K>(initial.column)
  const [dir, setDir] = useState<SortDir>(initial.dir ?? 'desc')

  const toggle = useCallback(
    (column: K) => {
      if (column === active) {
        setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setActive(column)
        setDir('desc')
      }
    },
    [active],
  )

  const sorted = useMemo(() => {
    if (!rows) return []
    const acc = accessors[active]
    const out = [...rows]
    out.sort((a, b) => {
      const av = acc(a)
      const bv = acc(b)
      // Nullish goes to the end regardless of direction.
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ? 1 : -1
      return 0
    })
    return out
  }, [rows, accessors, active, dir])

  const isActive = useCallback((column: K) => column === active, [active])
  return { sorted, active, dir, toggle, isActive }
}
