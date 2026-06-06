import type { Metadata, Viewport } from 'next'
import { Manrope } from 'next/font/google'
import { env } from '~/env'

import { cn } from '@tax-assistant/ui'

import { Providers } from '~/app/providers'
import { SiteHeader } from '~/widgets/site-header'

import '~/app/styles.css'

export const metadata: Metadata = {
  title: 'Налоговый помощник',
  description: 'Консультации по налоговым вопросам с проверенными экспертами',
}

// Read env.CONVEX_URL at request time, not at build time. Without this,
// Next.js statically prerenders /_not-found (and any other root-static page)
// at build, which fails because CONVEX_URL is undefined inside the Docker
// builder — defeating the runtime-env design.
export const dynamic = 'force-dynamic'

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#17212b' },
  ],
}

// Same Manrope wiring as the TMA — exposes `--font-sans-app`, which the
// shared theme reads via `var(--font-sans-app, var(--font-geist-sans, ...))`.
// Keeps the visual language aligned across surfaces.
const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans-app',
})

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={cn(
          'bg-background text-foreground min-h-screen font-sans antialiased',
          manrope.variable,
        )}
      >
        <Providers convexUrl={env.CONVEX_URL} convexSiteUrl={env.CONVEX_SITE_URL}>
          <SiteHeader />
          {props.children}
        </Providers>
      </body>
    </html>
  )
}
