'use client'

import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  Ellipsis,
  Fuel,
  Gavel,
  Home,
  Layers,
  MailQuestion,
  Percent,
  ScrollText,
} from 'lucide-react'

import { Button } from '@tax-assistant/ui/button'

import { cn } from '~/shared/lib'

import { HERO, TOPICS } from '../../model/content'

const ICONS: Record<string, LucideIcon> = {
  tax_audits: ClipboardCheck,
  tax_authority_interaction: MailQuestion,
  enforcement: Gavel,
  main_taxes: Percent,
  special_regimes: Layers,
  property_taxes: Home,
  resource_taxes: Fuel,
  reporting: ScrollText,
  registration: Building2,
  other: Ellipsis,
}

const VISIBLE_COUNT = 8

/** эксперт / эксперта / экспертов */
function pluralExperts(n: number): string {
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return 'экспертов'
  if (mod10 === 1) return 'эксперт'
  if (mod10 >= 2 && mod10 <= 4) return 'эксперта'
  return 'экспертов'
}

/**
 * Section 3 — topics catalog. Client island: selection lives in the URL
 * (?topic=code), eight tiles visible, the rest unfold behind "Все темы (N)".
 * The CTA below follows the selection and carries the topic to /orders.
 */
export function Situations() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [expanded, setExpanded] = useState(false)

  const selectedCode = searchParams.get('topic')
  const selected = TOPICS.find((t) => t.code === selectedCode)
  const visible = expanded ? TOPICS : TOPICS.slice(0, VISIBLE_COUNT)

  const toggle = (code: string) => {
    router.replace(code === selectedCode ? '/' : `/?topic=${code}`, { scroll: false })
  }

  return (
    <section id="situations" className="scroll-mt-20">
      <h2 className="text-foreground mb-6 text-center text-2xl font-bold tracking-tight">
        Тематики
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {visible.map((topic) => {
          const Icon = ICONS[topic.code] ?? Ellipsis
          const isSelected = topic.code === selectedCode
          return (
            <button
              key={topic.code}
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggle(topic.code)}
              className={cn(
                `flex min-h-[120px] flex-col justify-between gap-3 rounded-2xl border p-4 text-left
                transition-colors`,
                isSelected
                  ? 'border-primary bg-primary-soft'
                  : 'bg-card hover:bg-secondary/60 border-transparent',
              )}
            >
              <div
                className="bg-primary-soft text-primary flex size-10 items-center justify-center
                  rounded-[10px]"
              >
                <Icon className="size-5" strokeWidth={1.8} />
              </div>
              <div>
                <div className="text-foreground text-sm leading-tight font-bold">{topic.title}</div>
                <div className="text-hint mt-1 text-xs">
                  {topic.expertCount} {pluralExperts(topic.expertCount)}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex justify-center">
        <Button variant="ghost" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Свернуть' : `Все темы (${TOPICS.length})`}
        </Button>
      </div>

      <div className="mt-6 flex justify-center">
        <Button asChild size="lg" className="shadow-accent">
          <Link href={selected ? `/orders?topic=${selected.code}` : '/orders'}>
            {selected ? `Загрузить документ по теме «${selected.title}»` : HERO.ctaGuest}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </section>
  )
}
