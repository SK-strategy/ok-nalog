import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import { env } from '~/env'

import { cn } from '@tax-assistant/ui'

import { Providers } from '~/app/providers'
import { AdminShell } from '~/widgets/admin-shell'

import '~/app/styles.css'

export const metadata: Metadata = {
  title: 'Налоговый помощник — админка',
  description: 'Панель администратора',
}

// Read env.CONVEX_URL at request time, not at build time.
export const dynamic = 'force-dynamic'

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
          'bg-background text-foreground min-h-dvh font-sans antialiased',
          manrope.variable,
        )}
      >
        <Providers convexUrl={env.CONVEX_URL} convexSiteUrl={env.CONVEX_SITE_URL}>
          <AdminShell>{props.children}</AdminShell>
        </Providers>
      </body>
    </html>
  )
}
