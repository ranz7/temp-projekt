import { RANKING_LIMIT_DEFAULT } from '@backend/modules/ranking/internal-functions/limit'
import type { GetProblemOutputDTO } from '@backend/modules/task/endpoints/queries/get-problem/output.dto'
import { TRPCError } from '@trpc/server'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/app/_hooks/get-current-user'
import { getQueryClient, trpc } from '@/app/_trpc/rsc'
import { ProblemRanking } from './_components/problem-ranking'
import { ProblemStatement } from './_components/problem-statement'
import { SubmitPanel } from './_components/submit-panel'

type ProblemPageProps = {
  params: Promise<{ slug: string }>
}

export default async function ProblemPage({ params }: ProblemPageProps) {
  const { slug } = await params
  const queryClient = getQueryClient()

  let problem: GetProblemOutputDTO
  try {
    problem = await queryClient.fetchQuery(trpc.task.getProblem.queryOptions({ slug }))
  } catch (error) {
    if (error instanceof TRPCError && error.code === 'NOT_FOUND') {
      notFound()
    }
    throw error
  }

  const [ranking, user] = await Promise.all([
    queryClient.fetchQuery(
      trpc.ranking.getProblemRanking.queryOptions({ slug, limit: RANKING_LIMIT_DEFAULT })
    ),
    getCurrentUser()
  ])

  return (
    <main className='mx-auto flex w-full max-w-6xl flex-col gap-6 p-6'>
      <div className='grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]'>
        <ProblemStatement problem={problem} />
        <div className='flex flex-col gap-6'>
          <SubmitPanel
            problemSlug={problem.slug}
            languages={problem.languages}
            isSignedIn={user !== null}
          />
          <ProblemRanking rows={ranking} />
        </div>
      </div>
    </main>
  )
}
