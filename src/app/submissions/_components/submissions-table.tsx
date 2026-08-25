import type { SubmissionListRowDTO } from '@backend/modules/submission/endpoints/queries/list-submissions/output.dto'
import Link from 'next/link'
import { DataTable } from '@/app/_components/data-table'
import { EmptyState } from '@/app/_components/empty-state'
import { StatusBadge } from '@/app/_components/status-badge'
import { formatDateTime, formatLanguageLabel } from '../_lib/format'

type SubmissionsTableProps = {
  submissions: SubmissionListRowDTO[]
  /** Null for an anonymous visitor - nobody's row is clickable then. */
  currentUsername: string | null
}

/**
 * The public activity feed. Only the signed-in author's own rows carry a link
 * to the detail page - everybody else's row shows its status and nothing more.
 */
export function SubmissionsTable({ submissions, currentUsername }: SubmissionsTableProps) {
  if (submissions.length === 0) {
    return (
      <EmptyState title='No submissions yet' description='Nobody has submitted a solution yet.' />
    )
  }

  return (
    <DataTable>
      <thead>
        <tr className='border-border border-b text-left text-muted text-xs uppercase tracking-wide'>
          <th className='px-3 py-2 font-medium'>When</th>
          <th className='px-3 py-2 font-medium'>Problem</th>
          <th className='px-3 py-2 font-medium'>Submitted by</th>
          <th className='px-3 py-2 font-medium'>Language</th>
          <th className='px-3 py-2 font-medium'>Status</th>
          <th className='px-3 py-2 font-medium'>
            <span className='sr-only'>Open</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {submissions.map(submission => {
          const isOwn = currentUsername !== null && submission.username === currentUsername

          return (
            <tr key={submission.id} className='border-border border-b last:border-b-0'>
              <td className='whitespace-nowrap px-3 py-2'>
                {formatDateTime(submission.createdAt)}
              </td>
              <td className='px-3 py-2'>
                <Link
                  href={`/problems/${submission.problemSlug}`}
                  className='text-accent hover:underline'
                >
                  {submission.problemCode} - {submission.problemTitle}
                </Link>
              </td>
              <td className='px-3 py-2'>{submission.username}</td>
              <td className='px-3 py-2'>{formatLanguageLabel(submission.language)}</td>
              <td className='px-3 py-2'>
                <StatusBadge status={submission.status} />
              </td>
              <td className='px-3 py-2'>
                {isOwn ? (
                  <Link
                    href={`/submissions/${submission.id}`}
                    className='text-accent hover:underline'
                  >
                    View
                  </Link>
                ) : null}
              </td>
            </tr>
          )
        })}
      </tbody>
    </DataTable>
  )
}
