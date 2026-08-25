import { Skeleton } from './skeleton'

/** Fallback shown only while `HeaderSession` resolves - never the nav or brand. */
export function HeaderSessionSkeleton() {
  return <Skeleton className='h-9 w-20 rounded-lg' />
}
