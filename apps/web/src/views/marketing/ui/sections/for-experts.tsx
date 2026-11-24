import { FOR_EXPERTS } from '../../model/content'

/**
 * Section 11 — for experts. Inverted block (bg-foreground/text-background
 * flips correctly in both themes), no CTA: entry is by recommendation of
 * active experts only. RSC.
 */
export function ForExperts() {
  return (
    <section id="for-experts" className="scroll-mt-20">
      <div className="bg-foreground text-background rounded-3xl px-6 py-10 text-center">
        <span
          className="border-background/30 text-background inline-flex items-center rounded-full
            border px-3 py-1 text-[12px] font-semibold tracking-wide uppercase"
        >
          {FOR_EXPERTS.badge}
        </span>
        <h2 className="mx-auto mt-4 max-w-xl text-2xl font-bold tracking-tight">
          {FOR_EXPERTS.title}
        </h2>
        <p className="text-background/70 mx-auto mt-3 max-w-lg text-sm leading-relaxed">
          {FOR_EXPERTS.body}
        </p>
      </div>
    </section>
  )
}
