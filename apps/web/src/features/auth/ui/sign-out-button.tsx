'use client'

import { Button } from '@tax-assistant/ui/button'

import { useSession } from '~/entities/session'

export function SignOutButton() {
  const { signOut } = useSession()
  return (
    <Button variant="ghost" size="sm" onClick={() => void signOut()}>
      Выйти
    </Button>
  )
}
