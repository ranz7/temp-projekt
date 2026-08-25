import { Skeleton } from './skeleton'

/** Fallback shown while `SiteHeader` resolves the signed-in user, shaped like the real header. */
export function SiteHeaderSkeleton() {
  return (
    <div className='mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4'>
      <div className='flex flex-wrap items-center gap-6'>
        <Skeleton className='h-6 w-32' />
        <div className='flex items-center gap-4'>
          <Skeleton className='h-4 w-16' />
          <Skeleton className='h-4 w-20' />
          <Skeleton className='h-4 w-16' />
        </div>
      </div>
      <div className='flex items-center gap-3'>
        <Skeleton className='size-9 rounded-lg' />
        <Skeleton className='h-9 w-20 rounded-lg' />
      </div>
    </div>
  )
}
