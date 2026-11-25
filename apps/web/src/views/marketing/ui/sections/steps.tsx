import Link from 'next/link'

import { STEPS } from '../../model/content'

/**
 * Section 4 — how it works. Five numbered steps, ДОП principles woven in as
 * the supporting line of each step (brief §4). Vertical on mobile. RSC.
 */
export function Steps() {
  return (
    <section id="how" className="scroll-mt-20">
      <h2 className="text-foreground mb-6 text-center text-2xl font-bold tracking-tight">
        Как это работает
      </h2>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((step, i) => (
          <li key={step.action} className="bg-card flex flex-col gap-3 rounded-2xl border p-5">
            <div className="text-hint text-[11px] font-bold tracking-[0.06em] uppercase">
              Шаг {i + 1}
            </div>
            <h3 className="text-foreground text-base leading-tight font-bold">{step.action}</h3>
            <p className="text-text-soft text-sm leading-relaxed">{step.body}</p>
            {'link' in step && (
              <Link
                href={step.link.href}
                className="text-primary text-sm font-semibold underline-offset-4 hover:underline"
              >
                {step.link.label}
              </Link>
            )}
            <span className="text-primary mt-auto text-[12px] font-semibold">{step.principle}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
