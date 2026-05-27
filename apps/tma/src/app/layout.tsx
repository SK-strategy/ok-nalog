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
    // `h-full` on html + body propagates the actual rendered container size
    // (whatever Telegram's WebView / panel / iframe gives us) down the tree.
    // `dvh` resolves to the OS viewport, which on desktop Telegram is the
    // whole window — larger than the panel the TMA actually lives in, so a
    // `min-h-dvh` outer would exceed the panel and force page-level scroll.
    // Percentage heights inherit the parent's real size and avoid that.
    <html lang="ru" suppressHydrationWarning className="h-full">
      <head>
        {/* Telegram injects window.Telegram.WebApp once this loads. */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body
        className={cn(
          'bg-background text-foreground h-full font-sans antialiased',
          manrope.variable,
        )}
      >
        <Providers>{props.children}</Providers>
      </body>
    </html>
  )
}
