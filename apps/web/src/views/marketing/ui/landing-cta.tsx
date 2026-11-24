'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { Button } from '@tax-assistant/ui/button'

import { useSession } from '~/entities/session'

import { HERO } from '../model/content'

/**
 * Primary landing CTA — the only client island in the sections. Session-aware:
 * guests go to /orders (AuthGate meets them with the email-code form, the
 * "upload → register by code → /orders" flow from the brief); signed-in users
 * get a label that reflects where they land.
 */
export function LandingCTA() {
  const { me, isLoading } = useSession()

  return (
    <Button asChild size="lg" className="shadow-accent">
      <Link href="/orders">
        {!isLoading && me ? HERO.ctaAuthed : HERO.ctaGuest}
        <ArrowRight className="size-4" />
      </Link>
    </Button>
  )
}
