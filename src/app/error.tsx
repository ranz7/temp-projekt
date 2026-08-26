'use client'

import { ErrorState } from './_components/error-state'

export default function HomeError({
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className='flex flex-col gap-6'>
      <ErrorState description="This page couldn't load. Try refreshing." />
      <button type='button' onClick={reset} className='btn-secondary self-start'>
        Try again
      </button>
    </div>
  )
}
