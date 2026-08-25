import type { GetSubmissionOutputDTO } from '@backend/modules/submission/endpoints/queries/get-submission/output.dto'
import Link from 'next/link'
import { StatusBadge } from '@/app/_components/status-badge'
import { formatDateTime, formatLanguageLabel, formatScore } from '../../_lib/format'

type SubmissionOverviewProps = {
  submission: GetSubmissionOutputDTO
}

/** Problem, language, status, timestamps and score - everything but the source and the tests. */
export function SubmissionOverview({ submission }: SubmissionOverviewProps) {
  const isPending = submission.status === 'queued' || submission.status === 'running'

  return (
    <div className='flex flex-col gap-4 rounded-xl border border-border bg-card p-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex flex-col gap-1'>
          <Link
            href={`/problems/${submission.problemSlug}`}
            className='font-medium text-accent hover:underline'
          >
            {submission.problemCode} - {submission.problemTitle}
          </Link>
          <p className='text-muted text-xs'>{formatLanguageLabel(submission.language)}</p>
        </div>
        <StatusBadge status={submission.status} />
      </div>
      <dl className='grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3'>
        <div className='flex flex-col gap-0.5'>
          <dt className='text-muted text-xs'>Submitted</dt>
          <dd>{formatDateTime(submission.createdAt)}</dd>
        </div>
        <div className='flex flex-col gap-0.5'>
          <dt className='text-muted text-xs'>Judged</dt>
          <dd>{submission.judgedAt !== null ? formatDateTime(submission.judgedAt) : 'Not yet'}</dd>
        </div>
        <div className='flex flex-col gap-0.5'>
          <dt className='text-muted text-xs'>Score</dt>
          <dd>{formatScore(submission.score, submission.maxScore)}</dd>
        </div>
      </dl>
      {isPending ? (
        <p className='rounded-lg bg-placeholder px-3 py-2 text-sm'>
          {submission.status === 'queued' ? 'Waiting in the queue.' : 'Being judged right now.'}{' '}
          This page refreshes automatically every second.
        </p>
      ) : null}
      {submission.judgeMessage !== null ? (
        <p className='rounded-lg border border-border px-3 py-2 text-muted text-sm'>
          {submission.judgeMessage}
        </p>
      ) : null}
    </div>
  )
}
