import { Comparison } from './sections/comparison'
import { Deliverables } from './sections/deliverables'
import { DopPrinciples } from './sections/dop-principles'
import { Experts } from './sections/experts'
import { Faq } from './sections/faq'
import { FinalCta } from './sections/final-cta'
import { Founder } from './sections/founder'
import { Hero } from './sections/hero'
import { Privacy } from './sections/privacy'
import { ProofStrip } from './sections/proof-strip'
import { Situations } from './sections/situations'
import { Steps } from './sections/steps'

import './marketing.css'

/**
 * Landing composition. Server component: every section is RSC except the
 * marked client islands (LandingCTA, situations catalog, FAQ accordion).
 * Секции s1–s6 перенесены один в один из принятого preview/style-preview.html;
 * s7–s12 — прежняя разметка, палитра подтянута токенами .mkt в marketing.css.
 */
export function MarketingPage() {
  return (
    <main className="mkt">
      <Hero />
      <ProofStrip />
      <Situations />
      <Steps />
      <Deliverables />
      <Experts />
      <div className="mkt-sec mkt-sec--white">
        <div className="mkt-wrap">
          <Founder />
        </div>
      </div>
      <div className="mkt-sec mkt-sec--tint">
        <div className="mkt-wrap">
          <Comparison />
        </div>
      </div>
      <div className="mkt-sec mkt-sec--white">
        <div className="mkt-wrap">
          <DopPrinciples />
        </div>
      </div>
      <div className="mkt-sec">
        <div className="mkt-wrap">
          <Privacy />
        </div>
      </div>
      <div className="mkt-sec mkt-sec--white">
        <div className="mkt-wrap">
          <Faq />
        </div>
      </div>
      <div className="mkt-sec mkt-sec--tint">
        <div className="mkt-wrap">
          <FinalCta />
        </div>
      </div>
    </main>
  )
}
