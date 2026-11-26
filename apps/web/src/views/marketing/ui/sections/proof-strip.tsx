import { PROOF } from '../../model/content'

/** Section 2 — proof strip, перенос из preview: 4 ячейки, моно-номера 01–04. */
export function ProofStrip() {
  return (
    <section aria-label="Цифры" className="mkt-sec mkt-sec--tint">
      <div className="mkt-wrap">
        <div className="mkt-proof">
          {PROOF.map((item, i) => (
            <div className="mkt-proof-cell" key={item.value}>
              <span className="mkt-mono mkt-proof-num">{String(i + 1).padStart(2, '0')}</span>
              <div className="mkt-proof-value">{item.value}</div>
              <div className="mkt-proof-label">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
