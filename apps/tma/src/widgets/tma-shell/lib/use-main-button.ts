'use client'

import { useEffect, useRef } from 'react'

import { useTelegramWebApp } from './telegram'

export interface MainButtonConfig {
  /** Plain text — the native button can't render React nodes. */
  text: string
  onClick: () => void
  disabled?: boolean
  /** Shimmer animation; auto-disables tap. */
  loading?: boolean
}

/**
 * Wire the current screen's primary CTA to Telegram's native MainButton.
 *
 * Pass `undefined` to hide it (screens without a primary CTA). The click
 * handler is bridged through a ref so the registration effect only fires
 * once per WebApp instance.
 */
export function useMainButton(config: MainButtonConfig | undefined): void {
  const wa = useTelegramWebApp()
  const onClickRef = useRef<(() => void) | undefined>(config?.onClick)
  onClickRef.current = config?.onClick

  // text + visibility
  useEffect(() => {
    if (!wa) return
    if (!config) {
      wa.MainButton.hide()
      return
    }
    wa.MainButton.setText(config.text)
    wa.MainButton.show()
  }, [wa, config?.text, config === undefined])

  // disabled
  useEffect(() => {
    if (!wa || !config) return
    if (config.disabled) wa.MainButton.disable()
    else wa.MainButton.enable()
  }, [wa, config?.disabled, config === undefined])

  // loading
  useEffect(() => {
    if (!wa || !config) return
    if (config.loading) wa.MainButton.showProgress()
    else wa.MainButton.hideProgress()
  }, [wa, config?.loading, config === undefined])

  // click bridge — registers once per WebApp, reads latest handler from ref
  useEffect(() => {
    if (!wa) return
    const bridge = () => onClickRef.current?.()
    wa.MainButton.onClick(bridge)
    return () => wa.MainButton.offClick(bridge)
  }, [wa])

  // unmount cleanup — hide so the button doesn't leak across navigations when
  // the next screen happens not to call this hook at all
  useEffect(() => {
    if (!wa) return
    return () => {
      wa.MainButton.hide()
      wa.MainButton.hideProgress()
      wa.MainButton.enable()
    }
  }, [wa])
}
