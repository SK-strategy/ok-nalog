const DAY = 86_400_000
const dayFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })

/**
 * Compact, locale-aware relative date for order lists.
 *   < 1d → "сегодня"
 *   < 2d → "вчера"
 *   < 7d → "3 дн."
 *   else → "5 мая"
 */
export function formatRelativeDate(ts: number): string {
  const diff = Date.now() - ts
  if (diff < DAY) return 'сегодня'
  if (diff < 2 * DAY) return 'вчера'
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} дн.`
  return dayFormatter.format(new Date(ts))
}

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

const timeFormatter = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })

/** Chat-bubble timestamp: "12:34" for today, "5 мая, 12:34" otherwise. */
export function formatChatTimestamp(ts: number): string {
  const now = new Date()
  const at = new Date(ts)
  const sameDay =
    now.getFullYear() === at.getFullYear() &&
    now.getMonth() === at.getMonth() &&
    now.getDate() === at.getDate()
  return sameDay ? timeFormatter.format(at) : dateTimeFormatter.format(at)
}
