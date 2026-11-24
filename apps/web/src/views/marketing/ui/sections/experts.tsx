import { EXPERT_STATUS_LABEL, EXPERTS, EXPERTS_INTRO } from '../../model/content'

// SVG turbulence noise, no colors involved — texture for the blurred avatar.
const NOISE_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='96' height='96' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`

/**
 * Section 6 — experts. Anonymous dossiers (brief §2 + уточнения заказчика):
 * mono "ДОСЬЕ NN" label, blurred gradient avatar that sharpens on hover,
 * status stamp, role/function/tenure/scale fields. RSC.
 */
export function Experts() {
  return (
    <section id="experts" className="scroll-mt-20">
      <h2 className="text-foreground text-center text-2xl font-bold tracking-tight">
        {EXPERTS_INTRO.title}
      </h2>
      <p className="text-text-soft mx-auto mt-3 max-w-2xl text-center text-base leading-relaxed">
        {EXPERTS_INTRO.lead} Работают или работали в контрольных подразделениях ФНС.
      </p>
      <div className="bg-secondary mx-auto mt-6 max-w-2xl rounded-2xl px-5 py-4 text-center">
        <p className="text-text-soft text-sm leading-relaxed">{EXPERTS_INTRO.note}</p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXPERTS.map((expert) => (
          <article
            key={expert.id}
            className="group bg-card flex flex-col gap-4 rounded-2xl border p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl">
                  <div
                    className="from-primary/70 via-primary/30 to-primary-soft absolute -inset-2
                      bg-gradient-to-br blur-[7px] transition-all duration-300
                      group-hover:blur-[3px]"
                  />
                  <div
                    className="absolute inset-0 opacity-40"
                    style={{ backgroundImage: NOISE_BG }}
                  />
                </div>
                <div className="whitespace-nowrap">
                  <div className="text-hint font-mono text-[11px] tracking-[0.08em] uppercase">
                    Досье {expert.id}
                  </div>
                  <div className="text-foreground mt-0.5 text-sm font-bold">
                    Эксперт №{expert.id}
                  </div>
                </div>
              </div>
              <span
                className={
                  expert.status === 'active'
                    ? `border-primary/40 text-primary shrink-0 -rotate-2 rounded-md border px-2
                      py-0.5 text-[11px] font-bold tracking-wide whitespace-nowrap uppercase`
                    : `border-separator-strong text-text-soft shrink-0 -rotate-2 rounded-md border
                      px-2 py-0.5 text-[11px] font-bold tracking-wide whitespace-nowrap uppercase`
                }
              >
                {EXPERT_STATUS_LABEL[expert.status]}
              </span>
            </div>

            <dl className="flex flex-col gap-2">
              <Field label="Должность" value={expert.position} />
              <Field label="Функция" value={expert.func} />
              <Field label="Стаж" value={expert.experience} />
              <Field label="Масштаб" value={expert.scale} />
            </dl>
          </article>
        ))}
      </div>
    </section>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col items-start gap-0.5 sm:flex-row sm:items-baseline sm:justify-between
        sm:gap-3"
    >
      <dt className="text-hint shrink-0 text-xs">{label}</dt>
      <dd className="text-foreground text-left text-[13px] leading-snug font-medium sm:text-right">
        {value}
      </dd>
    </div>
  )
}
