import Link from 'next/link'

import { STEPS } from '../../model/content'

/** Section 4 — process steps, перенос из preview: карточки-шаги, моно-номера. */
export function Steps() {
  return (
    <section id="how" className="mkt-sec mkt-sec--tint scroll-mt-20">
      <div className="mkt-wrap">
        <div className="mkt-sec-head">
          <span className="mkt-mono">Процесс</span>
          <h2>Как это работает</h2>
        </div>
        <ol className="mkt-rail">
          {STEPS.map((step, i) => (
            <li className="mkt-step" key={step.action}>
              <span className="mkt-step-num">{String(i + 1).padStart(2, '0')}</span>
              <div className="mkt-step-body">
                <h3>{step.action}</h3>
                <p>{step.body}</p>
                {'link' in step ? (
                  <div>
                    <Link className="mkt-step-link" href={step.link.href}>
                      {step.link.label}
                    </Link>
                  </div>
                ) : null}
                <span className="mkt-principle">{step.principle}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
