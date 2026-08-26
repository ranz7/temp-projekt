import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { RawSearchParams } from '@/app/_components/problems/list-params'
import { parseProblemListParams } from '@/app/_components/problems/list-params'
import { ProblemListSection } from '@/app/_components/problems/problem-list-section'
import { getQueryClient, prefetchAwaited, trpc } from '@/app/_trpc/rsc'

const FACETS_PAGE_SIZE = 100

type ProblemsPageProps = {
  searchParams: Promise<RawSearchParams>
}

/** The full catalog: search, filter, sort and page through every problem. */
export default async function ProblemsPage({ searchParams }: ProblemsPageProps) {
  const params = parseProblemListParams(await searchParams)

  // Renders the first page on the server; the client takes over from here for
  // filter, sort and paging changes. The layout's own HydrationBoundary is
  // dehydrated before this async component runs, so this page needs its own,
  // built after prefetching, for the client query to pick up the SSR data.
  const [list] = await Promise.all([
    getQueryClient().fetchQuery(trpc.task.listProblems.queryOptions(params)),
    prefetchAwaited(trpc.task.listProblems.queryOptions({ pageSize: FACETS_PAGE_SIZE }))
  ])

  return (
    <div className='space-y-4'>
      <header className='space-y-1'>
        <h1 className='font-bold text-2xl text-foreground tracking-tight sm:text-3xl'>Problems</h1>
        <p className='text-muted text-sm'>
          Catalog of <span className='font-medium text-foreground tabular-nums'>{list.total}</span>{' '}
          tasks. Filter, sort and page through them.
        </p>
      </header>

      <HydrationBoundary state={dehydrate(getQueryClient())}>
        <ProblemListSection />
      </HydrationBoundary>
    </div>
  )
}
