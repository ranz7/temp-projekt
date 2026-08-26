import Link from 'next/link'
import { Card } from '@/app/_components/card'
import { DataTable } from '@/app/_components/data-table'
import { StatusBadge } from '@/app/_components/status-badge'
import { getCurrentUser } from '@/app/_hooks/get-current-user'
import { formatDateTime } from '@/app/submissions/_lib/format'
import { getRecentSubmissions } from './get-recent-submissions'

const RECENT_SUBMISSIONS_LIMIT = 12

/**
 * The newest submissions from everyone: when, which problem and how it went.
 * No source code - and only the author's own row opens, because a submission's
 * page shows the code and the tests it failed.
 */
export async function LatestSubmissions() {
  const [currentUser, { submissions }] = await Promise.all([
    getCurrentUser(),
    getRecentSubmissions(RECENT_SUBMISSIONS_LIMIT)
  ])

  return (
    <Card
      title='Latest submissions'
      subtitle='Recent judge queue activity'
      actionHref='/submissions'
      actionLabel='View all'
    >
      {submissions.length === 0 ? (
        <p className='px-4 py-6 text-muted text-sm sm:px-5'>Nothing has been submitted yet.</p>
      ) : (
        <DataTable>
          <thead>
            <tr>
              <th className='th'>Date</th>
              <th className='th'>Task</th>
              <th className='th'>Status</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-divider'>
            {submissions.map(submission => {
              const isOwn = currentUser !== null && currentUser.username === submission.username

              return (
                <tr key={submission.id} className='tr'>
                  <td className='td whitespace-nowrap text-muted tabular-nums'>
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
                    <Link href={`/problems/${submission.problemSlug}`} className='task-link'>
                      <span className='task-code'>{submission.problemCode}</span>
                      <span className='task-title'>{submission.problemTitle}</span>
                    </Link>
                  </td>
                  <td className='td'>
                    <StatusBadge status={submission.status} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </DataTable>
      )}
    </Card>
  )
}
