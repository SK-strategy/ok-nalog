import Image from 'next/image'

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
        <div
          className="relative mx-auto aspect-[4/5] w-full max-w-[260px] overflow-hidden rounded-2xl
            border sm:mx-0 sm:w-64 sm:max-w-none"
        >
          <Image
            src="/founder.jpg"
            alt="Константин Персиянов, основатель сервиса"
            fill
            sizes="(min-width: 640px) 256px, 260px"
            className="object-cover object-top"
          />
        </div>
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
