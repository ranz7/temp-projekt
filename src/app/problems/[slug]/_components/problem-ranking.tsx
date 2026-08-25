import type { ProblemRankingRowDTO } from '@backend/modules/ranking/endpoints/queries/get-problem-ranking/output.dto'
import { Card } from '@/app/_components/card'
import { DataTable } from '@/app/_components/data-table'
import { EmptyState } from '@/app/_components/empty-state'
import { LANGUAGE_LABELS } from './language'

const SOLVED_AT_FORMAT = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short'
})

/** This problem's ranking: everyone with an accepted solution, earliest first. */
export function ProblemRanking({ rows }: { rows: ProblemRankingRowDTO[] }) {
  return (
    <Card>
      <h2 className='font-semibold text-sm'>Ranking</h2>
      {rows.length === 0 ? (
        <EmptyState
          title='Nobody has solved this yet'
          description='Be the first accepted solution.'
        />
      ) : (
        <DataTable>
          <thead>
            <tr className='border-border border-b text-left text-muted text-xs'>
              <th className='px-3 py-2 font-medium'>#</th>
              <th className='px-3 py-2 font-medium'>User</th>
              <th className='px-3 py-2 font-medium'>Language</th>
              <th className='px-3 py-2 font-medium'>Solved</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.userId} className='border-border border-b last:border-b-0'>
                <td className='px-3 py-2 tabular-nums'>{row.rank}</td>
                <td className='px-3 py-2 font-medium'>{row.username}</td>
                <td className='px-3 py-2'>{LANGUAGE_LABELS[row.language]}</td>
                <td className='px-3 py-2 text-muted'>{SOLVED_AT_FORMAT.format(row.solvedAt)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </Card>
  )
}
