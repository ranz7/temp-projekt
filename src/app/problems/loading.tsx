import { ProblemTableSkeleton } from '@/app/_components/problems/problem-table-skeleton'
import { Skeleton } from '@/app/_components/skeleton'

export default function ProblemsLoading() {
  return (
    <div className='space-y-4'>
      <header className='space-y-1'>
        <h1 className='font-bold text-2xl text-foreground tracking-tight sm:text-3xl'>Problems</h1>
        <p className='text-muted text-sm'>Catalog of tasks. Filter, sort and page through them.</p>
      </header>
      <div className='card'>
        <div className='border-divider border-b p-4 sm:px-5'>
          <Skeleton className='h-20 w-full' />
        </div>
        <ProblemTableSkeleton />
      </div>
    </div>
  )
}
