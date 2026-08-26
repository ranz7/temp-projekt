import { Card } from './_components/card'
import { Skeleton } from './_components/skeleton'

const SUBMISSION_KEYS = ['s1', 's2', 's3', 's4', 's5', 's6']
const PROBLEM_KEYS = ['p1', 'p2', 'p3', 'p4']

export default function HomeLoading() {
  return (
    <div className='space-y-8'>
      <header className='space-y-1'>
        <h1 className='font-bold text-2xl text-foreground tracking-tight sm:text-3xl'>Dashboard</h1>
        <p className='max-w-2xl text-muted text-sm sm:text-base'>
          Browse proposed problems and watch the latest submissions as they move through the judge
          queue.
        </p>
      </header>

      <div className='grid gap-6 lg:grid-cols-5'>
        <div className='lg:col-span-3'>
          <Card title='Latest submissions' subtitle='Recent judge queue activity'>
            <div className='divide-y divide-divider'>
              {SUBMISSION_KEYS.map(key => (
                <div key={key} className='flex items-center gap-4 px-4 py-3 sm:px-5'>
                  <Skeleton className='h-4 w-36' />
                  <Skeleton className='h-4 flex-1' />
                  <Skeleton className='h-5 w-20 rounded-full' />
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className='lg:col-span-2'>
          <Card title='Proposed problems' subtitle='Tasks to try'>
            <div className='divide-y divide-divider'>
              {PROBLEM_KEYS.map(key => (
                <div key={key} className='flex flex-col gap-2 px-4 py-3 sm:px-5'>
                  <Skeleton className='h-4 w-2/3' />
                  <Skeleton className='h-3 w-1/3' />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
