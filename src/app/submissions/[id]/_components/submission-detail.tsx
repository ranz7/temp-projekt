'use client'

import type { GetSubmissionOutputDTO } from '@backend/modules/submission/endpoints/queries/get-submission/output.dto'
import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/app/_trpc/config'
import { CompilerOutput } from './compiler-output'
import { SourcePanel } from './source-panel'
import { SubmissionOverview } from './submission-overview'
import { TestResults } from './test-results'

const POLL_INTERVAL_MS = 1000

/** Only `queued` and `running` are non-final - matches the statuses list in the spec. */
function isJudgingInProgress(status: GetSubmissionOutputDTO['status']): boolean {
  return status === 'queued' || status === 'running'
}

type SubmissionDetailProps = {
  submissionId: string
  initialSubmission: GetSubmissionOutputDTO
}

/**
 * Polls the submission every second while it is still being judged, and stops
 * the instant a final status arrives. `initialData` seeds the query with what
 * the server already rendered, so there is no loading flash and no duplicate
 * fetch on mount.
 */
export function SubmissionDetail({ submissionId, initialSubmission }: SubmissionDetailProps) {
  const trpc = useTRPC()

  const { data: submission } = useQuery(
    trpc.submission.getSubmission.queryOptions(
      { id: submissionId },
      {
        initialData: initialSubmission,
        refetchInterval: query => {
          const status = query.state.data?.status ?? initialSubmission.status
          return isJudgingInProgress(status) ? POLL_INTERVAL_MS : false
        }
      }
    )
  )

  return (
    <div className='flex flex-col gap-6'>
      <SubmissionOverview submission={submission} />
      <SourcePanel
        problemSlug={submission.problemSlug}
        submissionId={submission.id}
        language={submission.language}
        sourceCode={submission.sourceCode}
      />
      {submission.compileMessage !== null ? (
        <CompilerOutput message={submission.compileMessage} />
      ) : null}
      {submission.tests.length > 0 ? <TestResults tests={submission.tests} /> : null}
    </div>
  )
}
