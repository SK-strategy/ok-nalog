import type { Metadata } from 'next'
import { env } from '~/env'

import { cn } from '@tax-assistant/ui'

import { Providers } from '~/app/providers'
import { AdminShell } from '~/widgets/admin-shell'

import '~/app/styles.css'
// Self-hosted Manrope — binds `--font-sans-app` for the shared theme.
import '~/app/fonts.css'

export const metadata: Metadata = {
  title: 'Налоговый помощник — админка',
  description: 'Панель администратора',
}

// Read env.CONVEX_URL at request time, not at build time.
export const dynamic = 'force-dynamic'

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={cn('bg-background text-foreground min-h-dvh font-sans antialiased')}>
        <Providers convexUrl={env.CONVEX_URL} convexSiteUrl={env.CONVEX_SITE_URL}>
          <AdminShell>{props.children}</AdminShell>
        </Providers>
      </body>
    </html>
  )
}
