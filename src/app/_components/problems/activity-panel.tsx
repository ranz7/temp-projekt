import Link from 'next/link'
import { Card } from '@/app/_components/card'
import { EmptyState } from '@/app/_components/empty-state'
import { StatusBadge } from '@/app/_components/status-badge'
import { getCurrentUser } from '@/app/_hooks/get-current-user'
import { getRecentSubmissions } from './get-recent-submissions'

const RECENT_SUBMISSIONS_LIMIT = 10

const SUBMITTED_AT_FORMAT = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short'
})

/** Newest submissions from everyone: who, which problem, its status and when. No source code. */
export async function ActivityPanel() {
  const [currentUser, { submissions }] = await Promise.all([
    getCurrentUser(),
    getRecentSubmissions(RECENT_SUBMISSIONS_LIMIT)
  ])

  return (
    <Card>
      <h2 className='font-semibold text-lg'>Recent activity</h2>
      {submissions.length === 0 ? (
        <EmptyState title='Nothing has been submitted yet.' />
      ) : (
        <ul className='flex flex-col gap-3'>
          {submissions.map(submission => {
            // A submission's own page shows source, tests and score - author-only.
            // Everyone else only ever sees this row.
            const isOwnSubmission =
              currentUser !== null && currentUser.username === submission.username

            return (
              <li
                key={submission.id}
                className='flex flex-col gap-1 border-border border-b pb-3 last:border-0 last:pb-0'
              >
                <div className='flex items-center justify-between gap-2'>
                  <Link
                    href={`/problems/${submission.problemSlug}`}
                    className='font-medium text-sm hover:underline'
                  >
                    {submission.problemCode} - {submission.problemTitle}
                  </Link>
                  <StatusBadge status={submission.status} />
                </div>
                <div className='flex items-center justify-between gap-2 text-muted text-xs'>
                  {isOwnSubmission ? (
                    <Link href={`/submissions/${submission.id}`} className='hover:underline'>
                      {submission.username}
                    </Link>
                  ) : (
                    <span>{submission.username}</span>
                  )}
                  <time dateTime={submission.createdAt.toISOString()}>
                    {SUBMITTED_AT_FORMAT.format(submission.createdAt)}
                  </time>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
