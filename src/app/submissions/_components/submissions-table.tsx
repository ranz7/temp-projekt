import type { SubmissionListRowDTO } from '@backend/modules/submission/endpoints/queries/list-submissions/output.dto'
import Link from 'next/link'
import { DataTable } from '@/app/_components/data-table'
import { StatusBadge } from '@/app/_components/status-badge'
import { formatDateTime, formatLanguageLabel } from '../_lib/format'

type SubmissionsTableProps = {
  submissions: SubmissionListRowDTO[]
  /** Null for an anonymous visitor - nobody's row is clickable then. */
  currentUsername: string | null
}

/**
 * The public activity feed. Only the signed-in author's own rows open - a
 * submission's page shows the source code and the tests it failed.
 */
export function SubmissionsTable({ submissions, currentUsername }: SubmissionsTableProps) {
  return (
    <div className='card'>
      <DataTable>
        <thead>
          <tr>
            <th className='th'>When</th>
            <th className='th'>Problem</th>
            <th className='th'>Lang</th>
            <th className='th'>Status</th>
            <th className='th'>User</th>
          </tr>
        </thead>
        <tbody className='divide-y divide-divider'>
          {submissions.length === 0 ? (
            <tr>
              <td className='td text-muted' colSpan={5}>
                No submissions yet.
              </td>
            </tr>
          ) : (
            submissions.map(submission => {
              const isOwn = currentUsername !== null && submission.username === currentUsername

              return (
                <tr key={submission.id} className='tr'>
                  <td className='td whitespace-nowrap text-muted text-xs'>
                    {isOwn ? (
                      <Link
                        href={`/submissions/${submission.id}`}
                        className='hover:text-accent hover:underline'
                      >
                        {formatDateTime(submission.createdAt)}
                      </Link>
                    ) : (
                      formatDateTime(submission.createdAt)
                    )}
                  </td>
                  <td className='td'>
                    <Link
                      href={`/problems/${submission.problemSlug}`}
                      className='font-medium text-accent hover:underline'
                    >
                      {submission.problemCode}
                    </Link>
                    <div className='text-muted text-xs'>{submission.problemTitle}</div>
                  </td>
                  <td className='td text-sm'>{formatLanguageLabel(submission.language)}</td>
                  <td className='td'>
                    {isOwn ? (
                      <Link href={`/submissions/${submission.id}`} className='inline-flex'>
                        <StatusBadge status={submission.status} />
                      </Link>
                    ) : (
                      <StatusBadge status={submission.status} />
                    )}
                  </td>
                  <td className='td text-muted text-sm'>{submission.username}</td>
                </tr>
              )
            })
          )}
        </tbody>
      </DataTable>
    </div>
  )
}
