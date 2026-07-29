// Domain tunables shared by Convex and every app.

/** Executor's cut of an order's approved price, in basis points (70%). */
export const EXECUTOR_SHARE_BPS = 7000

/** Customer must pay within this window or the order auto-expires (24 hours). */
export const PAYMENT_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Bounds for an executor's public handle. Generated handles sit well inside
 * this range («Внимательная Куница» is 20 chars); the ceiling exists for the
 * admin's free-text override, so a hand-written handle still fits the chat
 * header on a narrow phone.
 */
export const NICKNAME_MIN_LENGTH = 2
export const NICKNAME_MAX_LENGTH = 40

/** Answer-rating scale the customer leaves after the order is completed (1–5 stars). */
export const RATING_MIN = 1
export const RATING_MAX = 5

/** Server session lifetime after Telegram auth (7 days). */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Telegram `auth_date` older than this is rejected on verification, capping
 * replay of a captured Login Widget / initData payload (24 hours).
 */
export const TELEGRAM_AUTH_MAX_AGE_MS = 24 * 60 * 60 * 1000

/** Max attachments per order / message (jpeg, pdf, doc). */
export const MAX_ATTACHMENTS = 10
