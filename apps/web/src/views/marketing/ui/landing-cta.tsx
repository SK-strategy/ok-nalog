'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { useSession } from '~/entities/session'

import { HERO } from '../model/content'

/**
 * Primary landing CTA — the only client island in the sections. Session-aware:
 * guests go to /orders (AuthGate meets them with the email-code form);
 * signed-in users get a label that reflects where they land. Стили — кнопка
 * из принятого превью (marketing.css).
 */
export function LandingCTA() {
  const { me, isLoading } = useSession()

  return (
    <Link href="/orders" className="mkt-btn mkt-btn--primary">
      {!isLoading && me ? HERO.ctaAuthed : HERO.ctaGuest}
      <ArrowRight className="size-4" />
    </Link>
  )
}
