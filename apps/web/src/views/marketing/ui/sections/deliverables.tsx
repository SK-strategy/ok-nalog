import type { LucideIcon } from 'lucide-react'
import { FileCheck2, FileSearch, Map, Telescope } from 'lucide-react'

import { DELIVERABLES } from '../../model/content'

const ICONS: LucideIcon[] = [FileSearch, FileCheck2, Map, Telescope]

/**
 * Section 5 — what you get. 2×2 cards with icons: расшифровка / готовый
 * документ / дорожная карта / прогноз (brief §3, §4). RSC.
 */
export function Deliverables() {
  return (
    <section>
      <h2 className="text-foreground mb-6 text-center text-2xl font-bold tracking-tight">
        Что вы получаете
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {DELIVERABLES.map((item, i) => {
          const Icon = ICONS[i] ?? FileSearch
          return (
            <div key={item.title} className="bg-card flex flex-col gap-3 rounded-2xl border p-5">
              <div
                className="bg-primary-soft text-primary flex size-10 items-center justify-center
                  rounded-[10px]"
              >
                <Icon className="size-5" strokeWidth={1.8} />
              </div>
              <h3 className="text-foreground text-base leading-tight font-bold">{item.title}</h3>
              <p className="text-text-soft text-sm leading-relaxed">{item.body}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
