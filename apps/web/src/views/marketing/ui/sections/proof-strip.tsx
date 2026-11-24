import { PROOF } from '../../model/content'

/**
 * Section 2 — proof strip. 4 columns, 2×2 on mobile, hairline dividers via
 * gap-px over the separator color (brief §4). RSC.
 */
export function ProofStrip() {
  return (
    <section aria-label="Цифры">
      <div
        className="bg-separator grid grid-cols-2 gap-px overflow-hidden rounded-2xl sm:grid-cols-4"
      >
        {PROOF.map((item) => (
          <div key={item.value} className="bg-background flex flex-col gap-1 p-5 text-center">
            <div className="text-foreground text-xl font-bold tracking-tight">{item.value}</div>
            <div className="text-text-soft text-[13px] leading-snug">{item.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
