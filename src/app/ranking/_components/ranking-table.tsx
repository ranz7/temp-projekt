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
    <div className='card'>
      <DataTable>
        <thead>
          <tr>
            <th className='th'>Rank</th>
            <th className='th'>Person</th>
            <th className='th'>Problems solved</th>
          </tr>
        </thead>
        <tbody className='divide-y divide-divider'>
          {rows.map(row => {
            const isCurrentUser = row.userId === currentUserId

            return (
              <tr key={row.userId} className={cn('tr', isCurrentUser && 'bg-tint-blue')}>
                <td className='td tabular-nums'>{row.rank}</td>
                <td className='td'>
                  <div className='flex items-center gap-2'>
                    <span className='font-medium'>{row.username}</span>
                    {isCurrentUser ? (
                      <span className='badge bg-tint-blue text-tint-blue-ink ring-tint-blue-ring'>
                        You
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className='td tabular-nums'>{row.solvedCount}</td>
              </tr>
            )
          })}
        </tbody>
      </DataTable>
    </div>
  )
}
