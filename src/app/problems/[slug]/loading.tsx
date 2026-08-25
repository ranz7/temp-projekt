import { Card } from '@/app/_components/card'
import { Skeleton } from '@/app/_components/skeleton'

export default function ProblemLoading() {
  return (
    <main className='mx-auto flex w-full max-w-6xl flex-col gap-6 p-6'>
      <div className='grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]'>
        <Card className='gap-6'>
          <div className='flex flex-col gap-3'>
            <Skeleton className='h-7 w-64' />
            <div className='flex gap-2'>
              <Skeleton className='h-6 w-16 rounded-full' />
              <Skeleton className='h-6 w-20 rounded-full' />
              <Skeleton className='h-6 w-14 rounded-full' />
            </div>
            <Skeleton className='h-28 w-full' />
          </div>
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-3/4' />
          <Skeleton className='h-40 w-full' />
        </Card>
        <div className='flex flex-col gap-6'>
          <Card>
            <Skeleton className='h-5 w-32' />
            <Skeleton className='h-9 w-full' />
            <Skeleton className='h-96 w-full' />
            <Skeleton className='h-9 w-24' />
          </Card>
          <Card>
            <Skeleton className='h-5 w-20' />
            <Skeleton className='h-24 w-full' />
          </Card>
        </div>
      </div>
    </main>
  )
}
