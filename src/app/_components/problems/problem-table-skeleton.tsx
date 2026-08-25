import { Skeleton } from '@/app/_components/skeleton'

const SKELETON_ROW_KEYS = ['row-1', 'row-2', 'row-3', 'row-4', 'row-5', 'row-6']

/** Placeholder shaped like the real problem table - filters bar plus row skeletons. */
export function ProblemTableSkeleton() {
  return (
    <div className='flex flex-col gap-4'>
      <Skeleton className='h-28 w-full rounded-xl' />
      <div className='flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border'>
        {SKELETON_ROW_KEYS.map(key => (
          <div key={key} className='flex items-center gap-4 p-3'>
            <Skeleton className='h-4 w-14' />
            <Skeleton className='h-4 w-40 flex-1' />
            <Skeleton className='h-5 w-16 rounded-full' />
            <Skeleton className='h-4 w-24' />
            <Skeleton className='h-4 w-10' />
          </div>
        ))}
      </div>
    </div>
  )
}
