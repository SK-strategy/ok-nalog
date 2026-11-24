import { FOUNDER } from '../../model/content'

/**
 * Section 7 — founder. One column for now: name, title, facts, quote.
 * The grid below is the ready two-column skeleton — when the portrait
 * arrives, drop it into the first cell and the layout is done (brief §4).
 */
export function Founder() {
  return (
    <section>
      <h2 className="text-foreground mb-6 text-center text-2xl font-bold tracking-tight">
        Основатель
      </h2>
      <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
        {/* Портрет слева — когда появится фото основателя. */}
        <div className="bg-card rounded-2xl border p-6 sm:col-span-full">
          <div className="text-foreground text-lg font-bold tracking-tight">{FOUNDER.name}</div>
          <p className="text-text-soft mt-1 text-sm leading-relaxed">{FOUNDER.title}</p>
          <p className="text-hint mt-2 text-[13px]">{FOUNDER.facts}</p>
          <blockquote
            className="border-primary text-foreground mt-5 border-l-2 pl-4 text-base leading-relaxed
              font-medium"
          >
            «{FOUNDER.quote}»
          </blockquote>
        </div>
      </div>
    </section>
  )
}
