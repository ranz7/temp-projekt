import { Skeleton } from '@/app/_components/skeleton'

const META_SKELETON_KEYS = ['meta-1', 'meta-2', 'meta-3']

export default function SubmissionDetailLoading() {
  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-col gap-2'>
        <Skeleton className='h-8 w-64 max-w-full' />
        <Skeleton className='h-4 w-48' />
      </div>
      <div className='card flex flex-col gap-4 p-4'>
        <div className='flex items-center justify-between gap-3'>
          <Skeleton className='h-5 w-56' />
          <Skeleton className='h-6 w-24 rounded-full' />
        </div>
        <div className='grid grid-cols-2 gap-4 sm:grid-cols-3'>
          {META_SKELETON_KEYS.map(key => (
            <div key={key} className='flex flex-col gap-1'>
              <Skeleton className='h-3 w-16' />
              <Skeleton className='h-4 w-24' />
            </div>
          ))}
        </div>
      </div>
      <div className='card flex flex-col gap-3 p-4'>
        <Skeleton className='h-5 w-40' />
        <Skeleton className='h-48 w-full' />
      </div>
    </div>
  )
}
