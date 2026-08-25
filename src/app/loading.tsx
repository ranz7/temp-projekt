import { Skeleton } from './_components/skeleton'

export default function HomeLoading() {
  return (
    <main className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-6'>
      <div className='flex flex-col gap-2'>
        <Skeleton className='h-8 w-40' />
        <Skeleton className='h-4 w-80 max-w-full' />
      </div>
    </main>
  )
}
