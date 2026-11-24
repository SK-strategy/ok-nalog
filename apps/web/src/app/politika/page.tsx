import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Политика конфиденциальности — ОК, налог.нет',
}

// Stub so the footer link never 404s; full text pending (brief §4).
export default function PolitikaPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-foreground text-2xl font-bold tracking-tight">
        Политика конфиденциальности
      </h1>
      <p className="text-text-soft mt-3 text-sm">Текст готовится.</p>
    </main>
  )
}
