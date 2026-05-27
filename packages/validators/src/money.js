'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.rublesToKopecks = rublesToKopecks
exports.kopecksToRubles = kopecksToRubles
exports.formatKopecks = formatKopecks
exports.executorAccrual = executorAccrual
exports.platformFee = platformFee
var constants_1 = require('./constants')
// Money is always integer kopecks end to end. Convert/format only at the edges.
function rublesToKopecks(rubles) {
  return Math.round(rubles * 100)
}
function kopecksToRubles(kopecks) {
  return kopecks / 100
}
var rubFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})
/** `150000` → `"1 500 ₽"`. */
function formatKopecks(kopecks) {
  return rubFormatter.format(kopecksToRubles(kopecks))
}
/** Executor's accrual for a completed order (70% of the approved price). */
function executorAccrual(approvedPriceKopecks) {
  return Math.round((approvedPriceKopecks * constants_1.EXECUTOR_SHARE_BPS) / 10000)
}
/** Platform's retained share (the remaining 30%). */
function platformFee(approvedPriceKopecks) {
  return approvedPriceKopecks - executorAccrual(approvedPriceKopecks)
}
