import Link from 'next/link'
import { getCurrentUser } from '@/app/_hooks/get-current-user'
import { HeaderAuth } from './header-auth'
import { SiteNav } from './site-nav'
import { ThemeToggle } from './theme-toggle'

/** The shell header every screen sits under: brand, nav, theme toggle and auth. */
export async function SiteHeader() {
  const user = await getCurrentUser()

  return (
    <header className='border-border border-b'>
      <div className='mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4'>
        <div className='flex flex-wrap items-center gap-6'>
          <Link href='/' className='font-semibold text-lg tracking-tight'>
            Online Judge
          </Link>
          <SiteNav isSignedIn={user !== null} />
        </div>
        <div className='flex items-center gap-3'>
          <ThemeToggle />
          <HeaderAuth username={user?.username ?? null} />
        </div>
      </div>
    </header>
  )
}
