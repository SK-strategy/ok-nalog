import { Comparison } from './sections/comparison'
import { Deliverables } from './sections/deliverables'
import { DopPrinciples } from './sections/dop-principles'
import { Experts } from './sections/experts'
import { ForExperts } from './sections/for-experts'
import { Founder } from './sections/founder'
import { Hero } from './sections/hero'
import { Privacy } from './sections/privacy'
import { ProofStrip } from './sections/proof-strip'
import { Situations } from './sections/situations'
import { Steps } from './sections/steps'

/**
 * Landing composition. Server component: every section is RSC except the
 * marked client islands (LandingCTA, situations catalog, FAQ accordion).
 * Sections land one at a time; vertical rhythm 64px between them (brief §6).
 */
export function MarketingPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-16 px-4 py-12 sm:px-6 sm:py-16">
      <Hero />
      <ProofStrip />
      <Situations />
      <Steps />
      <Deliverables />
      <Experts />
      <Founder />
      <Comparison />
      <DopPrinciples />
      <Privacy />
      <ForExperts />
    </main>
  )
}
