import type { Metadata } from 'next'
import { Geist } from 'next/font/google'

import { cn } from '@tax-assistant/ui'

import { Providers } from '~/app/providers'

import '~/app/styles.css'

export const metadata: Metadata = {
  title: 'Налоговый помощник — админка',
  description: 'Панель администратора',
}

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={cn(
          'bg-background text-foreground min-h-screen font-sans antialiased',
          geistSans.variable,
        )}
      >
        <Providers>{props.children}</Providers>
      </body>
    </html>
  )
}
