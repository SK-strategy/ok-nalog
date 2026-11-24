import Link from 'next/link'

import { Button } from '@tax-assistant/ui/button'

import { HERO } from '../../model/content'
import { LandingCTA } from '../landing-cta'

/**
 * Section 1 — hero. Centered, max-w-3xl, 48px/30px H1, soft accent shadow
 * under the primary CTA (brief §4). RSC; session logic lives in LandingCTA.
 */
export function Hero() {
  return (
    <section className="flex flex-col items-center gap-6 text-center">
      <span
        className="bg-primary-soft text-primary inline-flex items-center gap-1.5 rounded-full px-3
          py-1 text-[12px] font-semibold tracking-wide uppercase"
      >
        {HERO.badge}
      </span>
      <h1
        className="text-foreground max-w-3xl text-3xl leading-tight font-bold tracking-tight
          sm:text-5xl"
      >
        {HERO.title}
      </h1>
      <p className="text-text-soft max-w-2xl text-base leading-relaxed sm:text-lg">
        {HERO.subtitle}
      </p>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <LandingCTA />
        <Button asChild size="lg" variant="outline">
          <Link href="#how">{HERO.ctaSecondary}</Link>
        </Button>
      </div>
    </section>
  )
}
