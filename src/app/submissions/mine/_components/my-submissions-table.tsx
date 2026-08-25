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
          <Link
            href='/problems'
            className='rounded-lg bg-accent px-3 py-2 font-medium text-accent-foreground text-sm'
          >
            Browse problems
          </Link>
        }
      />
    )
  }

  return (
    <DataTable>
      <thead>
        <tr className='border-border border-b text-left text-muted text-xs uppercase tracking-wide'>
          <th className='px-3 py-2 font-medium'>When</th>
          <th className='px-3 py-2 font-medium'>Problem</th>
          <th className='px-3 py-2 font-medium'>Language</th>
          <th className='px-3 py-2 font-medium'>Status</th>
          <th className='px-3 py-2 font-medium'>Score</th>
          <th className='px-3 py-2 font-medium'>
            <span className='sr-only'>Open</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {submissions.map(submission => (
          <tr key={submission.id} className='border-border border-b last:border-b-0'>
            <td className='whitespace-nowrap px-3 py-2'>{formatDateTime(submission.createdAt)}</td>
            <td className='px-3 py-2'>
              <Link
                href={`/problems/${submission.problemSlug}`}
                className='text-accent hover:underline'
              >
                {submission.problemCode} - {submission.problemTitle}
              </Link>
            </td>
            <td className='px-3 py-2'>{formatLanguageLabel(submission.language)}</td>
            <td className='px-3 py-2'>
              <StatusBadge status={submission.status} />
            </td>
            <td className='whitespace-nowrap px-3 py-2'>
              {formatScore(submission.score, submission.maxScore)}
            </td>
            <td className='px-3 py-2'>
              <Link href={`/submissions/${submission.id}`} className='text-accent hover:underline'>
                View
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  )
}
