import { LatestSubmissions } from './_components/problems/latest-submissions'
import { ProposedProblems } from './_components/problems/proposed-problems'
import { getQueryClient, trpc } from './_trpc/rsc'

const PROPOSED_PROBLEMS_LIMIT = 6

/** The dashboard: what the judge is doing right now, and what to solve next. */
export default async function HomePage() {
  const { problems } = await getQueryClient().fetchQuery(trpc.task.listProblems.queryOptions({}))

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
        <div className='min-w-0 lg:col-span-3'>
          <LatestSubmissions />
        </div>
        <div className='min-w-0 lg:col-span-2'>
          <ProposedProblems problems={problems.slice(0, PROPOSED_PROBLEMS_LIMIT)} />
        </div>
      </div>
    </div>
  )
}
