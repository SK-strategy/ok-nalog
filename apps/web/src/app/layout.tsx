import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

import { cn } from '@fedor/ui'

import { ConvexClientProvider } from '~/app/convex-provider'

import '~/app/styles.css'

export const metadata: Metadata = {
  title: 'Fedor',
  description: 'Fresh turborepo monorepo',
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
        <ConvexClientProvider>{props.children}</ConvexClientProvider>
      </body>
    </html>
  )
}
