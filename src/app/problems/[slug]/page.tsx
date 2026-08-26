import { RANKING_LIMIT_DEFAULT } from '@backend/modules/ranking/internal-functions/limit'
import type { GetProblemOutputDTO } from '@backend/modules/task/endpoints/queries/get-problem/output.dto'
import { TRPCError } from '@trpc/server'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/app/_hooks/get-current-user'
import { getQueryClient, trpc } from '@/app/_trpc/rsc'
import { ProblemPanel } from './_components/problem-panel'
import { ProblemStatement } from './_components/problem-statement'

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
    <div className='problem-detail-layout'>
      <div className='problem-detail-statement'>
        <ProblemStatement problem={problem} />
      </div>
      <ProblemPanel
        problemSlug={problem.slug}
        languages={problem.languages}
        isSignedIn={user !== null}
        ranking={ranking}
      />
    </div>
  )
}
