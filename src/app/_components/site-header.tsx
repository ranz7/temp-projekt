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
    <header className='sticky top-0 z-40 border-border/80 border-b bg-card/90 backdrop-blur'>
      <div className='mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6'>
        <div className='flex flex-wrap items-center gap-8'>
          <Link
            href='/'
            className='flex items-center gap-2 font-semibold tracking-tight'
            aria-label='Online Judge, home'
          >
            <span className='flex size-8 items-center justify-center rounded-lg bg-accent font-bold text-accent-foreground text-sm'>
              OJ
            </span>
            <span className='hidden sm:inline'>Online Judge</span>
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
