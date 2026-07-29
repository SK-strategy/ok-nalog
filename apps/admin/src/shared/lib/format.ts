const dateFmt = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const dateTimeFmt = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDate(ms: number): string {
  return dateFmt.format(new Date(ms))
}

export function formatDateTime(ms: number): string {
  return dateTimeFmt.format(new Date(ms))
}

/** Last 4 chars of a Convex id, uppercased — "№ A1B2" in UI. */
export function shortId(id: string): string {
  return id.slice(-4).toUpperCase()
}

/**
 * Compact elapsed-time label: "12 мин", "3 ч 40 мин", "2 дн 4 ч".
 *
 * Coarsens as the span grows — once something has been waiting for days, the
 * minutes are noise. Sub-minute spans read as "только что" rather than "0 мин",
 * which would look like a bug on a freshly created заявка.
 */
export function formatDuration(ms: number): string {
  if (ms < 60_000) return 'только что'
  const totalMinutes = Math.floor(ms / 60_000)
  const minutes = totalMinutes % 60
  const totalHours = Math.floor(totalMinutes / 60)
  const hours = totalHours % 24
  const days = Math.floor(totalHours / 24)
  if (days > 0) return hours > 0 ? `${days} дн ${hours} ч` : `${days} дн`
  if (totalHours > 0) return minutes > 0 ? `${totalHours} ч ${minutes} мин` : `${totalHours} ч`
  return `${totalMinutes} мин`
}
