import { Skeleton } from '@/app/_components/skeleton'

const SKELETON_ROW_KEYS = ['row-1', 'row-2', 'row-3', 'row-4', 'row-5', 'row-6']

/** Placeholder shaped like the real problem table, inside the panel that already holds the filters. */
export function ProblemTableSkeleton() {
  return (
    <div className='divide-y divide-divider'>
      {SKELETON_ROW_KEYS.map(key => (
        <div key={key} className='flex items-center gap-4 px-4 py-3 sm:px-5'>
          <Skeleton className='h-8 w-40' />
          <Skeleton className='h-5 w-32 rounded-full' />
          <Skeleton className='h-4 flex-1' />
          <Skeleton className='h-4 w-10' />
        </div>
      ))}
    </div>
  )
}
