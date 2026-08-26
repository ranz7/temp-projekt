import { Skeleton } from '@/app/_components/skeleton'

export default function ProblemLoading() {
  return (
    <div className='problem-detail-layout'>
      <div className='problem-detail-statement'>
        <article className='card'>
          <div className='space-y-3 border-divider border-b px-4 py-4 sm:px-5'>
            <Skeleton className='h-4 w-32' />
            <Skeleton className='h-7 w-64' />
            <div className='flex gap-2'>
              <Skeleton className='h-5 w-16 rounded-full' />
              <Skeleton className='h-5 w-20 rounded-full' />
              <Skeleton className='h-5 w-14 rounded-full' />
            </div>
          </div>
          <div className='space-y-4 px-4 py-5 sm:px-5'>
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-4 w-3/4' />
            <Skeleton className='h-40 w-full' />
          </div>
        </article>
      </div>
      <aside className='problem-detail-panel card'>
        <div className='border-divider border-b px-4 py-3'>
          <Skeleton className='h-5 w-48' />
        </div>
        <div className='space-y-3 p-4 sm:p-5'>
          <Skeleton className='h-9 w-full' />
          <Skeleton className='h-96 w-full' />
        </div>
      </aside>
    </div>
  )
}
