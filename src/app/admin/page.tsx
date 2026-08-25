import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { PageHeader } from '@/app/_components/page-header'
import { getQueryClient, trpc } from '@/app/_trpc/rsc'
import { AccessNotice } from './_components/access-notice'
import { AdminPanel } from './_components/admin-panel'

const PROBLEM_PICKER_PAGE_SIZE = 100

export default async function AdminPage() {
  const queryClient = getQueryClient()

  const [problemsData] = await Promise.all([
    queryClient.fetchQuery(
      trpc.task.listProblems.queryOptions({ pageSize: PROBLEM_PICKER_PAGE_SIZE })
    ),
    queryClient.fetchQuery(trpc.machine.listMachines.queryOptions()),
    queryClient.fetchQuery(trpc.benchmark.getBatchStatus.queryOptions()),
    queryClient.fetchQuery(trpc.benchmark.getThroughput.queryOptions())
  ])

  const problems = problemsData.problems.map(problem => ({
    slug: problem.slug,
    code: problem.code,
    title: problem.title
  }))

  return (
    <main className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-6'>
      <PageHeader
        title='Fleet control'
        description='Every checker machine, and load-testing batches against them.'
      />
      <AccessNotice />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <AdminPanel problems={problems} />
      </HydrationBoundary>
    </main>
  )
}
