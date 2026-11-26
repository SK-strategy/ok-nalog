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

import { HERO, TOPIC_SUBTITLE, TOPICS } from '../../model/content'

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

const VISIBLE_COUNT = 6

/** тема / темы / тем */
function pluralTopics(n: number): string {
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return 'тем'
  if (mod10 === 1) return 'тема'
  if (mod10 >= 2 && mod10 <= 4) return 'темы'
  return 'тем'
}

/**
 * Section 3 — topics catalog. Client island: selection lives in the URL
 * (?topic=code), six tiles visible, the rest unfold behind "Ещё N темы".
 * The CTA below follows the selection and carries the topic to /orders/new.
 * Разметка — из принятого превью (marketing.css).
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
    <section id="situations" className="mkt-sec mkt-sec--white scroll-mt-20">
      <div className="mkt-wrap">
        <div className="mkt-sec-head">
          <span className="mkt-mono">Направления</span>
          <h2>Тематики</h2>
        </div>

        <ul className="mkt-topics">
          {visible.map((topic) => {
            const Icon = ICONS[topic.code] ?? Ellipsis
            const isSelected = topic.code === selectedCode
            return (
              <li key={topic.code}>
                <button
                  type="button"
                  className="mkt-topic"
                  aria-pressed={isSelected}
                  onClick={() => toggle(topic.code)}
                >
                  <span className="mkt-topic-ico" aria-hidden="true">
                    <Icon size={22} strokeWidth={1.5} />
                  </span>
                  <span className="mkt-topic-title">{topic.title}</span>
                  <span className="mkt-topic-sub">{TOPIC_SUBTITLE}</span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="mkt-topics-more">
          <button
            type="button"
            className="mkt-btn mkt-btn--ghost"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded
              ? 'Свернуть'
              : `Ещё ${TOPICS.length - VISIBLE_COUNT} ${pluralTopics(TOPICS.length - VISIBLE_COUNT)}`}
          </button>
        </div>

        <div className="mkt-topics-more">
          {/* /orders/new renders AuthGate inline (no redirect), so ?topic=
              survives the email-code login for guests; signed-in users land
              on the form directly. The form itself doesn't consume topic
              yet — wiring topic → categoryId is the next step. */}
          <Link
            className="mkt-btn mkt-btn--primary"
            href={selected ? `/orders/new?topic=${selected.code}` : '/orders/new'}
          >
            {selected ? `Загрузить документ по теме «${selected.title}»` : HERO.ctaGuest}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
