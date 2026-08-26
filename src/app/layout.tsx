import { dehydrate } from '@tanstack/react-query'
import Script from 'next/script'
import type { ReactNode } from 'react'
import { SiteHeader } from './_components/site-header'
import { getQueryClient } from './_trpc/rsc'
import './globals.css'
import { GlobalProviders } from './providers'

export const metadata = {
  title: 'Online Judge',
  description: 'Solve problems and get them judged automatically.'
}

// Reads the stored theme (falling back to the OS preference) and applies it to
// <html> before first paint, so the page never flashes the wrong theme. Kept
// as a plain string so it can run with `beforeInteractive`, ahead of hydration.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('oj-theme');
    var isDark = stored === 'dark' || stored === 'light'
      ? stored === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`

export default function RootLayout({ children }: { children: ReactNode }) {
  const dehydratedState = dehydrate(getQueryClient())

  return (
    <html lang='en' suppressHydrationWarning>
      <body className='bg-background text-foreground antialiased'>
        <Script id='oj-theme-init' strategy='beforeInteractive'>
          {THEME_INIT_SCRIPT}
        </Script>
        <GlobalProviders dehydratedState={dehydratedState}>
          <div className='flex min-h-svh flex-col'>
            <SiteHeader />
            <main className='mx-auto w-full max-w-6xl px-4 py-8 sm:px-6'>{children}</main>
          </div>
        </GlobalProviders>
      </body>
    </html>
  )
}
