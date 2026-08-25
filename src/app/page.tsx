import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { PageHeader } from './_components/page-header'
import { ActivityPanel } from './_components/problems/activity-panel'
import type { RawSearchParams } from './_components/problems/list-params'
import { parseProblemListParams } from './_components/problems/list-params'
import { ProblemListSection } from './_components/problems/problem-list-section'
import { getQueryClient, prefetchAwaited, trpc } from './_trpc/rsc'

const FACETS_PAGE_SIZE = 100

type HomePageProps = {
  searchParams: Promise<RawSearchParams>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = parseProblemListParams(await searchParams)

  // Renders the first page on the server; the client takes over from here for
  // filter, sort and paging changes. The layout's own HydrationBoundary is
  // dehydrated before this async component runs, so this page needs its own,
  // built after prefetching, for the client query to pick up the SSR data.
  await Promise.all([
    prefetchAwaited(trpc.task.listProblems.queryOptions(params)),
    prefetchAwaited(trpc.task.listProblems.queryOptions({ pageSize: FACETS_PAGE_SIZE }))
  ])

  return (
    <main className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-6'>
      <PageHeader
        title='Problems'
        description='Browse problems and see what the community is solving.'
      />
      <div className='flex flex-col gap-6 lg:flex-row lg:items-start'>
        <div className='flex min-w-0 flex-1 flex-col gap-4'>
          <HydrationBoundary state={dehydrate(getQueryClient())}>
            <ProblemListSection />
          </HydrationBoundary>
        </div>
        <div className='w-full lg:w-80 lg:shrink-0'>
          <ActivityPanel />
        </div>
      </div>
    </main>
  )
}
