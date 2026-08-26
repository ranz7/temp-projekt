import type { ProblemRankingRowDTO } from '@backend/modules/ranking/endpoints/queries/get-problem-ranking/output.dto'
import { DataTable } from '@/app/_components/data-table'
import { LANGUAGE_LABELS } from './language'

const SOLVED_AT_FORMAT = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short'
})

/** This problem's ranking: everyone with an accepted solution, earliest first. */
export function ProblemRanking({ rows }: { rows: ProblemRankingRowDTO[] }) {
  if (rows.length === 0) {
    return (
      <p className='p-6 text-muted text-sm'>
        Nobody has solved this yet. Be the first accepted solution.
      </p>
    )
  }

  return (
    <DataTable>
      <thead>
        <tr>
          <th className='th'>#</th>
          <th className='th'>User</th>
          <th className='th'>Language</th>
          <th className='th'>Solved</th>
        </tr>
      </thead>
      <tbody className='divide-y divide-divider'>
        {rows.map(row => (
          <tr key={row.userId} className='tr'>
            <td className='td tabular-nums'>{row.rank}</td>
            <td className='td font-medium'>{row.username}</td>
            <td className='td'>{LANGUAGE_LABELS[row.language]}</td>
            <td className='td text-muted'>{SOLVED_AT_FORMAT.format(row.solvedAt)}</td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  )
}
