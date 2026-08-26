import type { MySubmissionListRowDTO } from '@backend/modules/submission/endpoints/queries/list-my-submissions/output.dto'
import Link from 'next/link'
import { DataTable } from '@/app/_components/data-table'
import { EmptyState } from '@/app/_components/empty-state'
import { StatusBadge } from '@/app/_components/status-badge'
import { formatDateTime, formatLanguageLabel, formatScore } from '../../_lib/format'

type MySubmissionsTableProps = {
  submissions: MySubmissionListRowDTO[]
}

/** Every row here belongs to the signed-in visitor, so every row links to its detail page. */
export function MySubmissionsTable({ submissions }: MySubmissionsTableProps) {
  if (submissions.length === 0) {
    return (
      <EmptyState
        title='No submissions yet'
        description='Solve a problem and submit a solution to see it here.'
        action={
          <Link href='/problems' className='btn-primary'>
            Browse problems
          </Link>
        }
      />
    )
  }

  return (
    <div className='card'>
      <DataTable>
        <thead>
          <tr>
            <th className='th'>When</th>
            <th className='th'>Problem</th>
            <th className='th'>Language</th>
            <th className='th'>Status</th>
            <th className='th'>Score</th>
            <th className='th'>
              <span className='sr-only'>Open</span>
            </th>
          </tr>
        </thead>
        <tbody className='divide-y divide-divider'>
          {submissions.map(submission => (
            <tr key={submission.id} className='tr'>
              <td className='td whitespace-nowrap'>{formatDateTime(submission.createdAt)}</td>
              <td className='td'>
                <Link
                  href={`/problems/${submission.problemSlug}`}
                  className='text-accent hover:underline'
                >
                  {submission.problemCode} - {submission.problemTitle}
                </Link>
              </td>
              <td className='td'>{formatLanguageLabel(submission.language)}</td>
              <td className='td'>
                <StatusBadge status={submission.status} />
              </td>
              <td className='td whitespace-nowrap'>
                {formatScore(submission.score, submission.maxScore)}
              </td>
              <td className='td'>
                <Link
                  href={`/submissions/${submission.id}`}
                  className='text-accent hover:underline'
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  )
}
