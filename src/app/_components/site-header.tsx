import Link from 'next/link'
import { Suspense } from 'react'
import { HeaderSession } from './header-session'
import { HeaderSessionSkeleton } from './header-session-skeleton'
import { SiteNav } from './site-nav'
import { ThemeToggle } from './theme-toggle'

/**
 * The shell header every screen sits under: brand, nav, theme toggle and
 * auth. Only `HeaderSession` (username/sign-out/"My submissions") depends
 * on the signed-in user and needs to suspend - everything else renders
 * synchronously so it mounts, and prefetches its links, exactly once.
 */
export function SiteHeader() {
  return (
    <header className='border-border border-b'>
      <div className='mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4'>
        <div className='flex flex-wrap items-center gap-6'>
          <Link href='/' className='font-semibold text-lg tracking-tight'>
            Online Judge
          </Link>
          <SiteNav />
        </div>
        <div className='flex items-center gap-3'>
          <ThemeToggle />
          <Suspense fallback={<HeaderSessionSkeleton />}>
            <HeaderSession />
          </Suspense>
        </div>
      </div>
    </header>
  )
}
