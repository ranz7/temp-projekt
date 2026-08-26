'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { DataTable } from '@/app/_components/data-table'
import { StatusBadge } from '@/app/_components/status-badge'
import { useTRPC } from '@/app/_trpc/config'
import { formatDateTime, formatLanguageLabel } from '@/app/submissions/_lib/format'

const PANEL_PAGE_SIZE = 50
const POLL_INTERVAL_MS = 2000

/**
 * Your own attempts at this problem, newest first. Polls while any of them is
 * still queued or running, and stops once every one has a verdict.
 */
export function ProblemSubmissionsPanel({ problemSlug }: { problemSlug: string }) {
  const trpc = useTRPC()

  const query = useQuery({
    ...trpc.submission.listMySubmissions.queryOptions({
      problemSlug,
      pageSize: PANEL_PAGE_SIZE
    }),
    refetchInterval: result => {
      const rows = result.state.data?.submissions ?? []
      const isJudging = rows.some(row => row.status === 'queued' || row.status === 'running')

      return isJudging ? POLL_INTERVAL_MS : false
    }
  })

  const submissions = query.data?.submissions ?? []

  if (query.isError) {
    return (
      <p className='p-6 text-muted text-sm'>
        <Link href='/login' className='text-accent hover:underline'>
          Log in
        </Link>{' '}
        to see your own attempts at this problem.
      </p>
    )
  }

  if (submissions.length === 0) {
    return (
      <p className='p-6 text-muted text-sm'>
        No submissions for this problem yet. Use the Submit tab to send one.
      </p>
    )
  }

  return (
    <DataTable>
      <thead>
        <tr>
          <th className='th'>Date</th>
          <th className='th'>Language</th>
          <th className='th'>Status</th>
        </tr>
      </thead>
      <tbody className='divide-y divide-divider'>
        {submissions.map(submission => (
          <tr key={submission.id} className='tr'>
            <td className='td whitespace-nowrap text-muted tabular-nums'>
              <Link
                href={`/submissions/${submission.id}`}
                className='hover:text-accent hover:underline'
              >
                {formatDateTime(submission.createdAt)}
              </Link>
            </td>
            <td className='td'>{formatLanguageLabel(submission.language)}</td>
            <td className='td'>
              <Link href={`/submissions/${submission.id}`} className='inline-flex'>
                <StatusBadge status={submission.status} />
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  )
}
