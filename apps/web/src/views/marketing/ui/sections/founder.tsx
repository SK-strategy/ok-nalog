import Image from 'next/image'

import { FOUNDER } from '../../model/content'

/**
 * Section 7 — founder. Вариант из preview/founder-block.html: фото-панель с
 * акцентной подложкой и плашкой, цитата карточкой на углу, факты чипсами.
 * Разметка-секция и отступы — обёртка в marketing-page.tsx.
 */
export function Founder() {
  return (
    <section>
      <div className="mkt-sec-head">
        <span className="mkt-mono">Личная гарантия</span>
        <h2>Основатель</h2>
      </div>

      <div className="mkt-founder">
        <div className="mkt-founder-art">
          <div className="mkt-founder-photo">
            <Image
              src="/founder.jpg"
              alt="Константин Персиянов, основатель сервиса"
              width={896}
              height={1200}
              sizes="(min-width: 1024px) 460px, 380px"
            />
            <span className="mkt-founder-tag">Основатель сервиса</span>
          </div>
          <blockquote className="mkt-founder-quote">
            <p>{FOUNDER.quote}»</p>
            <span className="mkt-mono">{FOUNDER.name}</span>
          </blockquote>
        </div>

        <div>
          <span className="mkt-mono">Экс-заместитель руководителя УФНС · Томская область</span>
          <p className="mkt-founder-name">{FOUNDER.name}</p>
          <p className="mkt-founder-role">Создатель сервиса. {FOUNDER.facts}.</p>
          <ul className="mkt-founder-facts">
            <li>15 лет в госорганах</li>
            <li>9 лет в ФНС</li>
            <li>Зам. руководителя УФНС</li>
          </ul>
          <p className="mkt-founder-note">
            Каждое обращение проходит планёрку с экспертами под его контролем — отвечает за
            результат лично, именем и репутацией.
          </p>
        </div>
      </div>
    </section>
  )
}
