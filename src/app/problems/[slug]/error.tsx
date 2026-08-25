'use client'

import { ErrorState } from '@/app/_components/error-state'

export default function ProblemError({
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className='mx-auto flex w-full max-w-6xl flex-col gap-6 p-6'>
      <ErrorState description="This problem couldn't load. Try refreshing." />
      <button
        type='button'
        onClick={reset}
        className='self-start rounded-lg border border-border px-3 py-2 font-medium text-sm hover:bg-placeholder'
      >
        Try again
      </button>
    </main>
  )
}
