'use strict'
// Domain tunables shared by Convex and every app.
Object.defineProperty(exports, '__esModule', { value: true })
exports.MAX_ATTACHMENTS =
  exports.TELEGRAM_AUTH_MAX_AGE_MS =
  exports.SESSION_TTL_MS =
  exports.PAYMENT_WINDOW_MS =
  exports.EXECUTOR_SHARE_BPS =
    void 0
/** Executor's cut of an order's approved price, in basis points (70%). */
exports.EXECUTOR_SHARE_BPS = 7000
/** Customer must pay within this window or the order auto-expires (1 hour). */
exports.PAYMENT_WINDOW_MS = 60 * 60 * 1000
/** Server session lifetime after Telegram auth (7 days). */
exports.SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
/**
 * Telegram `auth_date` older than this is rejected on verification, capping
 * replay of a captured Login Widget / initData payload (24 hours).
 */
exports.TELEGRAM_AUTH_MAX_AGE_MS = 24 * 60 * 60 * 1000
/** Max attachments per order / message (jpeg, pdf, doc). */
exports.MAX_ATTACHMENTS = 10
