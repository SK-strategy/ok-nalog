import { cn } from '~/shared/lib'

import { COMPARISON } from '../../model/content'

/**
 * Section 8 — why not a law firm, why not an AI bot. One block per criterion,
 * three columns inside; the platform column is highlighted. On mobile the
 * columns stack, labels stay visible (brief §4). RSC.
 */
export function Comparison() {
  return (
    <section>
      <h2 className="text-foreground mb-6 text-center text-2xl font-bold tracking-tight">
        {COMPARISON.title}
      </h2>
      <div className="flex flex-col gap-4">
        {COMPARISON.rows.map((row) => (
          <div key={row.criterion} className="bg-card rounded-2xl border p-5">
            <div className="text-hint text-[11px] font-bold tracking-[0.06em] uppercase">
              {row.criterion}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {row.cells.map((cell, j) => {
                const ours = j === row.cells.length - 1
                return (
                  <div
                    key={COMPARISON.columns[j]}
                    className={cn('rounded-xl p-3', ours ? 'bg-primary-soft' : 'bg-secondary')}
                  >
                    <div
                      className={cn(
                        'text-[11px] font-bold tracking-wide uppercase',
                        ours ? 'text-primary' : 'text-hint',
                      )}
                    >
                      {COMPARISON.columns[j]}
                    </div>
                    <div className="text-foreground mt-1 text-sm leading-snug">{cell}</div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
