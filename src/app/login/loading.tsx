import { Card } from '../_components/card'
import { Skeleton } from '../_components/skeleton'

export default function LoginLoading() {
  return (
    <div className='mx-auto flex w-full max-w-sm flex-col gap-6'>
      <div className='flex flex-col gap-2'>
        <Skeleton className='h-8 w-28' />
        <Skeleton className='h-4 w-56 max-w-full' />
      </div>
      <Card bodyClassName='p-4 sm:p-5'>
        <div className='flex flex-col gap-1.5'>
          <Skeleton className='h-4 w-20' />
          <Skeleton className='h-9 w-full' />
        </div>
        <Skeleton className='h-9 w-full' />
      </Card>
    </div>
  )
}
