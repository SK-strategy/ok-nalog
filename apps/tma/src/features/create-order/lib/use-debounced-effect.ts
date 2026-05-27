'use client'

import { useEffect, useRef } from 'react'

/**
 * Runs `effect` after `deps` stop changing for `delay` ms. Each new change
 * resets the timer; unmount clears any pending fire. Used to debounce the
 * draft auto-save so we don't write on every keystroke.
 */
export function useDebouncedEffect(effect: () => void, deps: readonly unknown[], delay: number) {
  const effectRef = useRef(effect)
  effectRef.current = effect

  useEffect(() => {
    const id = window.setTimeout(() => effectRef.current(), delay)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay])
}
