import { PRINCIPLES } from '../../model/content'

/**
 * Section 9 — ДОП principles. Five one-liners in a row, vertical on mobile
 * (brief §4). RSC.
 */
export function DopPrinciples() {
  return (
    <section>
      <h2 className="text-foreground mb-6 text-center text-2xl font-bold tracking-tight">
        На что опираемся
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {PRINCIPLES.map((p) => (
          <div key={p.word} className="bg-card flex flex-col gap-2 rounded-2xl border p-5">
            <div className="text-foreground text-base font-bold">{p.word}</div>
            <p className="text-text-soft text-sm leading-relaxed">{p.line}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
