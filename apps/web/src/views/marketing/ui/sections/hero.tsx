import Image from 'next/image'
import Link from 'next/link'

import { HERO } from '../../model/content'
import { LandingCTA } from '../landing-cta'

/**
 * Section 1 — hero, перенос из preview/style-preview.html. Левая колонка:
 * eyebrow, H1 с красными акцентами, подзаголовок, CTA, моно-строка доверия.
 * Правая: скан требования с размытием юрлица (только ПК). RSC; сессия — в
 * LandingCTA.
 */
export function Hero() {
  return (
    <section className="mkt-sec mkt-sec--white">
      <div className="mkt-wrap mkt-hero">
        <div className="mkt-hero-copy">
          <p className="mkt-eyebrow">{HERO.badge}</p>
          <h1>
            <span className="mkt-h1-line">
              Пришло требование из <span className="mkt-urgent">ФНС</span>?
            </span>{' '}
            Получи в течении 24 часов ответ от эксперта из налоговой системы
          </h1>
          <p className="mkt-hero-lead">{HERO.subtitle}</p>
          <div className="mkt-hero-actions">
            <LandingCTA />
            <Link className="mkt-btn mkt-btn--secondary" href="#how">
              {HERO.ctaSecondary}
            </Link>
          </div>
          <p className="mkt-mono mkt-hero-trust">Без предоплаты · Договор · NDA</p>
        </div>

        <figure className="mkt-hero-art">
          <div className="mkt-art-plate">
            <Image
              src="/trebov.png"
              width={1394}
              height={1644}
              alt="Скан требования ФНС о представлении пояснений"
              priority
            />
          </div>
          <span className="mkt-art-tag">Входящее · ФНС</span>
          <span className="mkt-art-stamp">Принято</span>
        </figure>
      </div>
    </section>
  )
}
