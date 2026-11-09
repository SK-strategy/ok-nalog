'use client'

import Link from 'next/link'

import { Button } from '@tax-assistant/ui/button'

/**
 * Entry point to sign-in. Login is passwordless by email: the user enters an
 * address, gets a 6-digit code and is in. The form itself lives in AuthGate
 * (rendered by /orders for signed-out visitors), so this is just a link there.
 */
export function LoginButton() {
  return (
    <Button asChild size="lg">
      <Link href="/orders">Войти по почте</Link>
    </Button>
  )
}
