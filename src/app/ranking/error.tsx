'use client'

import { ErrorState } from '../_components/error-state'

export default function RankingError({
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className='flex flex-col gap-6'>
      <ErrorState description="The ranking couldn't load. Try refreshing." />
      <button type='button' onClick={reset} className='btn-secondary self-start'>
        Try again
      </button>
    </div>
  )
}
