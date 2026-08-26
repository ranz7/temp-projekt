import { getCurrentUser } from '@/app/_hooks/get-current-user'
import { getQueryClient, trpc } from '@/app/_trpc/rsc'
import { EmptyState } from '../_components/empty-state'
import { PageHeader } from '../_components/page-header'
import { RankingTable } from './_components/ranking-table'

export default async function RankingPage() {
  const [rows, currentUser] = await Promise.all([
    getQueryClient().fetchQuery(trpc.ranking.getGlobalRanking.queryOptions()),
    getCurrentUser()
  ])

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title='Ranking'
        description='People ranked by how many distinct problems they have an accepted solution for. Equal counts go to whoever reached that count first.'
      />
      {rows.length === 0 ? (
        <EmptyState
          title='No one has solved a problem yet'
          description='Once someone gets an accepted solution, they will show up here.'
        />
      ) : (
        <RankingTable rows={rows} currentUserId={currentUser?.id ?? null} />
      )}
    </div>
  )
}
