import { FINAL_CTA } from '../../model/content'
import { LandingCTA } from '../landing-cta'

/**
 * Section 13 — final CTA. Soft background, rounded-3xl (brief §4). RSC; the
 * button is the shared session-aware island.
 */
export function FinalCta() {
  return (
    <section>
      <div
        className="bg-primary-soft flex flex-col items-center gap-4 rounded-3xl px-6 py-10
          text-center"
      >
        <h2 className="text-foreground max-w-xl text-2xl font-bold tracking-tight">
          {FINAL_CTA.title}
        </h2>
        <p className="text-text-soft max-w-lg text-sm leading-relaxed">{FINAL_CTA.body}</p>
        <LandingCTA />
      </div>
    </section>
  )
}
