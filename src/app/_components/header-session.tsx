import Link from 'next/link'
import { getCurrentUser } from '@/app/_hooks/get-current-user'
import { HeaderAuth } from './header-auth'

/**
 * The only part of the header that depends on who is signed in: the
 * signed-in-only "My submissions" link plus the username/sign-out or
 * sign-in control. Kept as its own async Server Component, wrapped in its
 * own `Suspense`, so the brand and the always-the-same nav links around it
 * render synchronously and never double-mount.
 */
export async function HeaderSession() {
  const user = await getCurrentUser()

  return (
    <div className='flex items-center gap-4 text-sm'>
      {user !== null ? (
        <Link href='/submissions/mine' className='text-muted hover:text-foreground'>
          My submissions
        </Link>
      ) : null}
      <HeaderAuth username={user?.username ?? null} />
    </div>
  )
}
