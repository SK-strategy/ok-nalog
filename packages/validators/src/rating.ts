import { RATING_MAX, RATING_MIN } from './constants'

// The customer's 1–5 star rating and its aggregation into the executor's
// reputation. Shared by Convex (mutation guard) and the apps (star widget +
// cabinet/admin display) so the scale and rounding live in exactly one place.

/** Whole numbers within the inclusive [RATING_MIN, RATING_MAX] star scale only. */
export function isValidRating(score: number): boolean {
  return Number.isInteger(score) && score >= RATING_MIN && score <= RATING_MAX
}

/** Mean of the accumulated ratings, or `null` when the executor has none. */
export function averageRating(ratingSum: number, ratingCount: number): number | null {
  return ratingCount > 0 ? ratingSum / ratingCount : null
}

/** One-decimal display form (`4.3`), or `'—'` when there are no ratings yet. */
export function formatRating(ratingSum: number, ratingCount: number): string {
  const avg = averageRating(ratingSum, ratingCount)
  return avg === null ? '—' : avg.toFixed(1)
}

/**
 * Filled-star count for the average, rounded to a whole star in [0, RATING_MAX].
 * `0` when there are no ratings yet (renders as an all-empty row).
 */
export function ratingStars(ratingSum: number, ratingCount: number): number {
  const avg = averageRating(ratingSum, ratingCount)
  if (avg === null) return 0
  return Math.min(RATING_MAX, Math.max(0, Math.round(avg)))
}
