import type { Metadata, Viewport } from 'next'
import { Manrope } from 'next/font/google'
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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#17212b' },
  ],
}

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans-app',
})

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/* Telegram injects window.Telegram.WebApp once this loads. */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body
        className={cn(
          'bg-background text-foreground min-h-screen font-sans antialiased',
          manrope.variable,
        )}
      >
        <Providers>{props.children}</Providers>
      </body>
    </html>
  )
}
