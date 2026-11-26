import { User } from 'lucide-react'

import { EXPERT_STATUS_LABEL, EXPERTS, EXPERTS_INTRO } from '../../model/content'

/**
 * Section 6 — experts, перенос из preview: досье без лиц, единая заглушка
 * аватара, моно-ключи, статус плашкой.
 */
export function Experts() {
  return (
    <section id="experts" className="mkt-sec mkt-sec--tint scroll-mt-20">
      <div className="mkt-wrap">
        <div className="mkt-sec-head">
          <span className="mkt-mono">Команда</span>
          <h2>{EXPERTS_INTRO.title}</h2>
          <p className="mkt-lead">
            {EXPERTS_INTRO.lead} Работают или работали в контрольных подразделениях ФНС.
          </p>
        </div>

        <div className="mkt-experts">
          {EXPERTS.map((expert) => (
            <article className="mkt-expert" key={expert.id}>
              <div className="mkt-expert-top">
                <div className="mkt-expert-id">
                  <span className="mkt-avatar" aria-hidden="true">
                    <User size={24} strokeWidth={1.5} />
                  </span>
                  <span>
                    <span className="mkt-mono mkt-dossier">Досье {expert.id}</span>
                    <span className="mkt-expert-name">
                      Эксперт №{expert.id} · {expert.name}
                    </span>
                  </span>
                </div>
                <span className={`mkt-status mkt-status--${expert.status}`}>
                  {EXPERT_STATUS_LABEL[expert.status]}
                </span>
              </div>
              <dl className="mkt-fields">
                <Field label="Должность" value={expert.position} />
                <Field label="Функция" value={expert.func} />
                <Field label="Стаж" value={expert.experience} />
                <Field label="Масштаб" value={expert.scale} />
              </dl>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mkt-field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
