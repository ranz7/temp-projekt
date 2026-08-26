'use client'

import { useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { useTRPC } from '@/app/_trpc/config'

/** Signed-out state: a link to the login screen. Signed-in state: username plus sign out. */
export function HeaderAuth({ username }: { username: string | null }) {
  const trpc = useTRPC()
  const logOutMutation = useMutation(
    trpc.account.logOut.mutationOptions({
      onSuccess: () => {
        // router.refresh() alone leaves the root layout's Suspense-wrapped
        // header on its stale, cached render (see the login form for the
        // same issue in reverse). Reload the current page so every Server
        // Component - the header included - re-renders against the cleared
        // session cookie right away.
        window.location.reload()
      }
    })
  )

  if (username === null) {
    return (
      <Link href='/login' className='btn-primary'>
        Sign in
      </Link>
    )
  }

  return (
    <div className='flex items-center gap-3 text-sm'>
      <span className='text-muted'>{username}</span>
      <button
        type='button'
        onClick={() => logOutMutation.mutate(undefined)}
        disabled={logOutMutation.isPending}
        className='btn-secondary'
      >
        Sign out
      </button>
    </div>
  )
}
