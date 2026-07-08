import { RATING_MAX, RATING_MIN } from './constants'

// The customer's 1–10 answer rating and its aggregation into the executor's
// reputation. Shared by Convex (mutation guard) and the apps (rating widget +
// cabinet display) so the scale and rounding live in exactly one place.

/** Whole numbers within the inclusive [RATING_MIN, RATING_MAX] scale only. */
export function isValidRating(score: number): boolean {
  return Number.isInteger(score) && score >= RATING_MIN && score <= RATING_MAX
}

/** Mean of the accumulated ratings, or `null` when the executor has none. */
export function averageRating(ratingSum: number, ratingCount: number): number | null {
  return ratingCount > 0 ? ratingSum / ratingCount : null
}

/** One-decimal display form (`8.6`), or `'—'` when there are no ratings yet. */
export function formatRating(ratingSum: number, ratingCount: number): string {
  const avg = averageRating(ratingSum, ratingCount)
  return avg === null ? '—' : avg.toFixed(1)
}
