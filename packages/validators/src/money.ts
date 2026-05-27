import { EXECUTOR_SHARE_BPS } from './constants'

// Money is always integer kopecks end to end. Convert/format only at the edges.

export function rublesToKopecks(rubles: number): number {
  return Math.round(rubles * 100)
}

export function kopecksToRubles(kopecks: number): number {
  return kopecks / 100
}

const rubFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

/** `150000` → `"1 500 ₽"`. */
export function formatKopecks(kopecks: number): string {
  return rubFormatter.format(kopecksToRubles(kopecks))
}

/** Executor's accrual for a completed order (70% of the approved price). */
export function executorAccrual(approvedPriceKopecks: number): number {
  return Math.round((approvedPriceKopecks * EXECUTOR_SHARE_BPS) / 10_000)
}

/** Platform's retained share (the remaining 30%). */
export function platformFee(approvedPriceKopecks: number): number {
  return approvedPriceKopecks - executorAccrual(approvedPriceKopecks)
}
