import type { LucideIcon } from 'lucide-react'
import { EyeOff, Lock, MessageSquareLock, UserCheck } from 'lucide-react'

import { PRIVACY } from '../../model/content'

const ICONS: LucideIcon[] = [Lock, EyeOff, MessageSquareLock, UserCheck]

/**
 * Section 10 — privacy. Text + icons: encryption, data masking, anonymized
 * chat, who sees what (brief §4). RSC.
 */
export function Privacy() {
  return (
    <section>
      <h2 className="text-foreground mb-6 text-center text-2xl font-bold tracking-tight">
        Приватность
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PRIVACY.map((item, i) => {
          const Icon = ICONS[i] ?? Lock
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
