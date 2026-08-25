import { Skeleton } from '@/app/_components/skeleton'

const ROW_SKELETON_KEYS = ['row-1', 'row-2', 'row-3', 'row-4', 'row-5', 'row-6']

export default function MySubmissionsLoading() {
  return (
    <main className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-6'>
      <div className='flex flex-col gap-2'>
        <Skeleton className='h-8 w-52' />
        <Skeleton className='h-4 w-80 max-w-full' />
      </div>
      <div className='flex flex-col gap-3 rounded-xl border border-border p-4'>
        {ROW_SKELETON_KEYS.map(key => (
          <Skeleton key={key} className='h-8 w-full' />
        ))}
      </div>
    </main>
  )
}
