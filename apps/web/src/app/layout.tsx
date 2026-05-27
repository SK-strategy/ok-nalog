import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

import { cn } from '@tax-assistant/ui'

import { Providers } from '~/app/providers'
import { SiteHeader } from '~/widgets/site-header'

import '~/app/styles.css'

export const metadata: Metadata = {
  title: 'Налоговый помощник',
  description: 'Консультации по налоговым вопросам с проверенными экспертами',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          'bg-background text-foreground min-h-screen font-sans antialiased',
          geistSans.variable,
          geistMono.variable,
        )}
      >
        <Providers>
          <SiteHeader />
          {props.children}
        </Providers>
      </body>
    </html>
  )
}
