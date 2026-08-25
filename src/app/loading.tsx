import { PageHeader } from './_components/page-header'
import { ProblemTableSkeleton } from './_components/problems/problem-table-skeleton'
import { Skeleton } from './_components/skeleton'

const ACTIVITY_SKELETON_KEYS = ['activity-1', 'activity-2', 'activity-3', 'activity-4']

export default function HomeLoading() {
  return (
    <main className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-6'>
      <PageHeader
        title='Problems'
        description='Browse problems and see what the community is solving.'
      />
      <div className='flex flex-col gap-6 lg:flex-row lg:items-start'>
        <div className='flex min-w-0 flex-1 flex-col gap-4'>
          <ProblemTableSkeleton />
        </div>
        <div className='flex w-full flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:w-80 lg:shrink-0'>
          <Skeleton className='h-5 w-32' />
          {ACTIVITY_SKELETON_KEYS.map(key => (
            <div
              key={key}
              className='flex flex-col gap-1.5 border-border border-b pb-3 last:border-0 last:pb-0'
            >
              <Skeleton className='h-4 w-full' />
              <Skeleton className='h-3 w-2/3' />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
