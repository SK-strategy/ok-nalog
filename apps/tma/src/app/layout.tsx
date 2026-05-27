import type { Metadata, Viewport } from 'next'
import Script from 'next/script'

import { cn } from '@tax-assistant/ui'

import { Providers } from '~/app/providers'

import '~/app/styles.css'

export const metadata: Metadata = {
  title: 'Налоговый помощник',
  description: 'Telegram Mini App',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/* Telegram injects window.Telegram.WebApp once this loads. */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body className={cn('bg-background text-foreground min-h-screen font-sans antialiased')}>
        <Providers>{props.children}</Providers>
      </body>
    </html>
  )
}
