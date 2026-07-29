'use client'

import { useEffect, useState } from 'react'

/**
 * Current wall-clock time, re-rendering on an interval.
 *
 * Elapsed-time labels ("ждёт 3 ч 40 мин") are derived from `Date.now()`, which
 * React has no reason to recompute on its own — without a tick the moderation
 * table would freeze at whatever the durations were when the page loaded, and
 * an admin who leaves the tab open would read stale numbers as current ones.
 *
 * 30s default: the labels round to whole minutes, so anything faster just burns
 * renders, and anything slower lets the visible minute drift behind.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
