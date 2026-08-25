import { dehydrate } from '@tanstack/react-query'
import { Inter } from 'next/font/google'
import type { ReactNode } from 'react'
import { getQueryClient } from './_trpc/rsc'
import './globals.css'
import { GlobalProviders } from './providers'

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap'
})

export const metadata = {
  title: 'Notes',
  description: 'Notes listed from Postgres through tRPC.'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const dehydratedState = dehydrate(getQueryClient())

  return (
    <html lang='pl' className={inter.variable}>
      <body className='bg-background text-foreground antialiased'>
        <GlobalProviders dehydratedState={dehydratedState}>{children}</GlobalProviders>
      </body>
    </html>
  )
}
