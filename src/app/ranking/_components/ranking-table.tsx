import type { GlobalRankingRowDTO } from '@backend/modules/ranking/endpoints/queries/get-global-ranking/output.dto'
import { cn } from '@/app/_components/cn'
import { DataTable } from '@/app/_components/data-table'

type RankingTableProps = {
  rows: readonly GlobalRankingRowDTO[]
  currentUserId: string | null
}

/** Global ranking table. Renders the order the server already computed - never re-sorts. */
export function RankingTable({ rows, currentUserId }: RankingTableProps) {
  return (
    <DataTable>
      <thead>
        <tr className='border-border border-b text-left text-muted text-xs uppercase tracking-wide'>
          <th className='px-4 py-3 font-medium'>Rank</th>
          <th className='px-4 py-3 font-medium'>Person</th>
          <th className='px-4 py-3 font-medium'>Problems solved</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => {
          const isCurrentUser = row.userId === currentUserId

          return (
            <tr
              key={row.userId}
              className={cn(
                'border-border border-b last:border-b-0',
                isCurrentUser && 'bg-accent/10'
              )}
            >
              <td className='px-4 py-3 tabular-nums'>{row.rank}</td>
              <td className='px-4 py-3'>
                <div className='flex items-center gap-2'>
                  <span className='font-medium'>{row.username}</span>
                  {isCurrentUser ? (
                    <span className='rounded-full bg-accent/15 px-2 py-0.5 text-accent text-xs'>
                      You
                    </span>
                  ) : null}
                </div>
              </td>
              <td className='px-4 py-3 tabular-nums'>{row.solvedCount}</td>
            </tr>
          )
        })}
      </tbody>
    </DataTable>
  )
}
