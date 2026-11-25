import { FOUNDER } from '../../model/content'

/**
 * Section 7 — founder. Two columns from sm: portrait on the left,
 * card with name, title, facts and quote on the right (brief §4).
 */
export function Founder() {
  return (
    <section>
      <h2 className="text-foreground mb-6 text-center text-2xl font-bold tracking-tight">
        Основатель
      </h2>
      <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- локальный портрет из public */}
        <img
          src="/founder.jpg"
          alt="Константин Персиянов, основатель сервиса"
          className="mx-auto w-full max-w-64 rounded-2xl border object-cover sm:mx-0"
        />
        <div className="bg-card rounded-2xl border p-6">
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
