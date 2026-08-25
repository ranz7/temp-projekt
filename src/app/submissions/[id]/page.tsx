import { appRouter } from '@backend/appRouter'
import { createCallerFactory, createTRPCContext } from '@backend/trpc'
import { TRPCError } from '@trpc/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ErrorState } from '@/app/_components/error-state'
import { PageHeader } from '@/app/_components/page-header'
import { getCurrentUser } from '@/app/_hooks/get-current-user'
import { SubmissionDetail } from './_components/submission-detail'

const createCaller = createCallerFactory(appRouter)

type SubmissionDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function SubmissionDetailPage({ params }: SubmissionDetailPageProps) {
  const { id } = await params
  const user = await getCurrentUser()

  // The endpoint answers a stranger and a signed-out visitor with the same
  // FORBIDDEN error - only here, with the session already read, can the two
  // be told apart the way the spec wants.
  if (user === null) {
    redirect('/login')
  }

  const ctx = await createTRPCContext({ headers: new Headers(await headers()) })
  const caller = createCaller(ctx)

  try {
    const submission = await caller.submission.getSubmission({ id })

    return (
      <main className='mx-auto flex w-full max-w-4xl flex-col gap-6 p-6'>
        <PageHeader
          title={`${submission.problemCode} submission`}
          description={submission.problemTitle}
        />
        <SubmissionDetail submissionId={id} initialSubmission={submission} />
      </main>
    )
  } catch (error) {
    // A malformed id fails input validation before the handler even runs -
    // from a visitor's point of view that is the same as "no such submission".
    if (!(error instanceof TRPCError)) throw error

    const message =
      error.code === 'FORBIDDEN'
        ? 'Only the author of a submission can open it.'
        : 'We could not find that submission.'

    return (
      <main className='mx-auto flex w-full max-w-4xl flex-col gap-6 p-6'>
        <PageHeader title='Submission' />
        <ErrorState title="Can't open this submission" description={message} />
      </main>
    )
  }
}
