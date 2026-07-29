import { cn } from './index'

// Read-only star rating. Dumb on purpose: the caller passes the average
// (`value`, or null for "no ratings yet") — the scale/rounding logic lives in
// @tax-assistant/validators (averageRating/ratingStars) so this stays a pure
// presentation widget with no domain dependency. Whole-star fill.

const SIZE: Record<'sm' | 'md', string> = {
  sm: 'text-[13px]',
  md: 'text-base',
}

export function StarRating({
  value,
  count,
  max = 5,
  size = 'sm',
  showValue = true,
  showCount = false,
  emptyLabel = 'нет оценок',
  className,
}: {
  /** Average rating, or `null` when there are no ratings yet. */
  value: number | null
  /** Number of ratings behind the average (for the optional count suffix). */
  count?: number
  max?: number
  size?: 'sm' | 'md'
  showValue?: boolean
  showCount?: boolean
  emptyLabel?: string
  className?: string
}) {
  const filled = value === null ? 0 : Math.min(max, Math.max(0, Math.round(value)))
  return (
    // Theme-agnostic: `amber-400` is a built-in palette color (works in every
    // app), and empty stars / text lean on opacity over the inherited color
    // rather than a `muted-foreground` token that some apps (TMA) don't define.
    <span className={cn('inline-flex items-center gap-1', SIZE[size], className)}>
      <span className="tracking-tight" aria-hidden>
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={i < filled ? 'text-amber-400' : 'opacity-25'}>
            ★
          </span>
        ))}
      </span>
      {value === null ? (
        <span className="text-xs opacity-60">{emptyLabel}</span>
      ) : (
        showValue && (
          <span className="text-xs tabular-nums opacity-60">
            {value.toFixed(1)}
            {showCount && count !== undefined ? ` · ${count}` : ''}
          </span>
        )
      )}
    </span>
  )
}
