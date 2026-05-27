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
