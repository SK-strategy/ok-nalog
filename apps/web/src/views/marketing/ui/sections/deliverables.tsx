import { DELIVERABLES } from '../../model/content'

/** Section 5 — what you get, перенос из preview: 4 карточки, моно-номера. */
export function Deliverables() {
  return (
    <section className="mkt-sec mkt-sec--white">
      <div className="mkt-wrap">
        <div className="mkt-sec-head">
          <span className="mkt-mono">Результат</span>
          <h2>Что вы получаете</h2>
        </div>
        <div className="mkt-deliv">
          {DELIVERABLES.map((item, i) => (
            <div className="mkt-deliv-item" key={item.title}>
              <span className="mkt-deliv-num">{String(i + 1).padStart(2, '0')}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
