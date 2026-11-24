import { Deliverables } from './sections/deliverables'
import { Experts } from './sections/experts'
import { Hero } from './sections/hero'
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
    </main>
  )
}
