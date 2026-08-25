'use client'

import { useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTRPC } from '@/app/_trpc/config'

/** Signed-out state: a link to the login screen. Signed-in state: username plus sign out. */
export function HeaderAuth({ username }: { username: string | null }) {
  const trpc = useTRPC()
  const router = useRouter()
  const logOutMutation = useMutation(
    trpc.account.logOut.mutationOptions({
      onSuccess: () => {
        router.refresh()
      }
    })
  )

  if (username === null) {
    return (
      <Link
        href='/login'
        className='rounded-lg bg-accent px-3 py-2 font-medium text-accent-foreground text-sm'
      >
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
        className='rounded-lg border border-border px-3 py-2 font-medium hover:bg-placeholder disabled:opacity-60'
      >
        Sign out
      </button>
    </div>
  )
}
