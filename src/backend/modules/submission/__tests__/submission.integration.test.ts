import { appRouter } from '@backend/appRouter'
import { db } from '@backend/database/db'
import {
  SESSION_COOKIE_NAME,
  signSession
} from '@backend/modules/account/internal-functions/session'
import { account__user_ } from '@backend/modules/account/schema'
import { closeSubmissionQueue } from '@backend/modules/submission/internal-functions/queue'
import {
  submission__submission_,
  submission__test_result_
} from '@backend/modules/submission/schema'
import { task__problem_, task__problem_test_ } from '@backend/modules/task/schema'
import { seedTaskProblems } from '@backend/modules/task/seed'
import { createCallerFactory, createTRPCContext } from '@backend/trpc'
import { and, eq, like } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { POST as claimRoute } from '@/app/api/internal/checker/claim/route'

const createCaller = createCallerFactory(appRouter)

const usernamePrefix = 'itest-submission-'
const problemSlug = 'cf-4-A'
const pythonSource = 'print("YES")\n'
/** A string that must never come back from any endpoint. */
const hiddenActualOutput = 'HIDDEN-OUTPUT-MUST-NEVER-LEAVE'

async function caller(cookieHeader?: string) {
  const headers = new Headers()
  if (cookieHeader) headers.set('cookie', cookieHeader)

  return createCaller(await createTRPCContext({ headers, resHeaders: new Headers() }))
}

function sessionCookieFor(userId: string): string {
  return `${SESSION_COOKIE_NAME}=${signSession(userId)}`
}

async function signIn(name: string): Promise<{ id: string; username: string }> {
  const anonymous = await caller()

  return anonymous.account.logIn({ username: `${usernamePrefix}${name}` })
}

async function callerFor(userId: string) {
  return caller(sessionCookieFor(userId))
}

async function removeTestUsers() {
  await db.delete(account__user_).where(like(account__user_.username_, `${usernamePrefix}%`))
}

async function findSubmissionRows(userId: string) {
  return db
    .select()
    .from(submission__submission_)
    .where(eq(submission__submission_.user_id_, userId))
}

async function findProblemTestId(visibility: 'public' | 'hidden'): Promise<string> {
  const [problem] = await db
    .select({ id: task__problem_.id })
    .from(task__problem_)
    .where(eq(task__problem_.slug_, problemSlug))

  const [test] = await db
    .select({ id: task__problem_test_.id })
    .from(task__problem_test_)
    .where(
      and(
        eq(task__problem_test_.problem_id_, problem.id),
        eq(task__problem_test_.visibility_, visibility),
        eq(task__problem_test_.ordinal_, 1)
      )
    )

  return test.id
}

const checkerServiceKey = 'itest-submission-checker-service-key'

beforeAll(async () => {
  process.env.SESSION_SECRET ??= 'integration-test-secret'
  // Nothing listens here, so every wake-up fails - exactly the outage the spec cares about.
  process.env.REDIS_URL = 'redis://127.0.0.1:6399'
  process.env.SERVICE_KEY = checkerServiceKey
  await seedTaskProblems(db)
})

beforeEach(removeTestUsers)

afterAll(async () => {
  await removeTestUsers()
  closeSubmissionQueue()
})

describe('submission.createSubmission', () => {
  it('queues one solution for the signed-in person', async () => {
    const author = await signIn('author')
    const trpc = await callerFor(author.id)

    const created = await trpc.submission.createSubmission({
      problemSlug,
      language: 'python',
      sourceCode: pythonSource
    })

    expect(created.status).toBe('queued')

    const rows = await findSubmissionRows(author.id)

    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(created.id)
    expect(rows[0].user_id_).toBe(author.id)
    expect(rows[0].status_).toBe('queued')
    expect(rows[0].language_).toBe('python')
    expect(rows[0].source_code_).toBe(pythonSource)
  })

  it('still saves the solution when the wake-up channel is down', async () => {
    const author = await signIn('offline-queue')
    const trpc = await callerFor(author.id)

    const created = await trpc.submission.createSubmission({
      problemSlug,
      language: 'python',
      sourceCode: pythonSource
    })

    const rows = await findSubmissionRows(author.id)

    expect(created.status).toBe('queued')
    expect(rows).toHaveLength(1)
    // Left empty on purpose: the sweeper knows this one still needs publishing.
    expect(rows[0].queue_published_at_).toBeNull()
  })

  it('still lets a checker claim and judge the solution once Redis is down', async () => {
    const author = await signIn('offline-claimable')
    const trpc = await callerFor(author.id)

    const created = await trpc.submission.createSubmission({
      problemSlug,
      language: 'python',
      sourceCode: pythonSource
    })

    // No sweeper involved here: a checker's own poll finds the row exactly as it was
    // left by createSubmission, proving the outage never kept it from being judged.
    const headers = new Headers({ 'content-type': 'application/json' })
    headers.set('x-service-key', checkerServiceKey)

    const claimResponse = await claimRoute(
      new Request('http://127.0.0.1/api/internal/checker/claim', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          contractVersion: 1,
          workerId: 'itest-offline-claim-worker',
          languages: ['python', 'cpp']
        })
      })
    )

    expect(claimResponse.status).toBe(200)

    const payload = (await claimResponse.json()) as { job: { submissionId: string } | null }

    expect(payload.job).not.toBeNull()
    expect(payload.job?.submissionId).toBe(created.id)

    const [row] = await findSubmissionRows(author.id)

    expect(row.status_).toBe('running')
  })

  it('refuses a language the judge does not run and saves nothing', async () => {
    const author = await signIn('java')
    const trpc = await callerFor(author.id)

    await expect(
      trpc.submission.createSubmission({
        problemSlug,
        language: 'java',
        sourceCode: 'class Main {}'
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    expect(await findSubmissionRows(author.id)).toHaveLength(0)
  })

  it('refuses an empty solution', async () => {
    const author = await signIn('empty')
    const trpc = await callerFor(author.id)

    await expect(
      trpc.submission.createSubmission({ problemSlug, language: 'python', sourceCode: '' })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    expect(await findSubmissionRows(author.id)).toHaveLength(0)
  })

  it('answers not found for a problem nobody has', async () => {
    const author = await signIn('unknown-problem')
    const trpc = await callerFor(author.id)

    await expect(
      trpc.submission.createSubmission({
        problemSlug: 'no-such-problem',
        language: 'python',
        sourceCode: pythonSource
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    expect(await findSubmissionRows(author.id)).toHaveLength(0)
  })

  it('turns away a visitor who is not signed in', async () => {
    const trpc = await caller()

    await expect(
      trpc.submission.createSubmission({
        problemSlug,
        language: 'python',
        sourceCode: pythonSource
      })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})

describe('submission.getSubmission', () => {
  it('opens for its author and for nobody else', async () => {
    const author = await signIn('detail-author')
    const stranger = await signIn('detail-stranger')
    const authorTrpc = await callerFor(author.id)

    const created = await authorTrpc.submission.createSubmission({
      problemSlug,
      language: 'python',
      sourceCode: pythonSource
    })

    const detail = await authorTrpc.submission.getSubmission({ id: created.id })

    expect(detail.id).toBe(created.id)
    expect(detail.problemSlug).toBe(problemSlug)
    expect(detail.problemTitle.length).toBeGreaterThan(0)
    expect(detail.sourceCode).toBe(pythonSource)
    expect(detail.status).toBe('queued')
    expect(detail.tests).toEqual([])

    const strangerTrpc = await callerFor(stranger.id)
    await expect(strangerTrpc.submission.getSubmission({ id: created.id })).rejects.toMatchObject({
      code: 'FORBIDDEN'
    })

    const anonymousTrpc = await caller()
    await expect(anonymousTrpc.submission.getSubmission({ id: created.id })).rejects.toMatchObject({
      code: 'FORBIDDEN'
    })
  })

  it('shows what a sample printed and never what a hidden test printed', async () => {
    const author = await signIn('tests-author')
    const trpc = await callerFor(author.id)

    const created = await trpc.submission.createSubmission({
      problemSlug,
      language: 'python',
      sourceCode: pythonSource
    })

    await db.insert(submission__test_result_).values([
      {
        submission_id_: created.id,
        problem_test_id_: await findProblemTestId('public'),
        ordinal_: 1,
        visibility_: 'public',
        verdict_: 'passed',
        passed_: true,
        points_awarded_: 0,
        actual_output_: 'YES',
        time_ms_: 10,
        memory_kb_: 2048
      },
      {
        submission_id_: created.id,
        problem_test_id_: await findProblemTestId('hidden'),
        ordinal_: 1,
        visibility_: 'hidden',
        verdict_: 'wrong_answer',
        passed_: false,
        points_awarded_: 0,
        message_: hiddenActualOutput,
        actual_output_: hiddenActualOutput,
        time_ms_: 12,
        memory_kb_: 4096
      }
    ])

    const detail = await trpc.submission.getSubmission({ id: created.id })

    expect(detail.tests).toHaveLength(2)

    const [sample, hidden] = detail.tests

    expect(sample.visibility).toBe('public')
    expect(sample.visibility === 'public' && sample.actualOutput).toBe('YES')
    expect(sample.visibility === 'public' && sample.input).toBe('8')
    expect(hidden.visibility).toBe('hidden')
    expect(hidden.passed).toBe(false)
    expect(hidden.timeMs).toBe(12)
    expect(Object.keys(hidden).sort()).toEqual([
      'memoryKb',
      'ordinal',
      'passed',
      'pointsAwarded',
      'timeMs',
      'verdict',
      'visibility'
    ])
    expect(JSON.stringify(detail)).not.toContain(hiddenActualOutput)
  })
})

describe('submission.listSubmissions', () => {
  it('shows everybody the newest submissions without their source code', async () => {
    const first = await signIn('feed-first')
    const second = await signIn('feed-second')

    const firstCreated = await (await callerFor(first.id)).submission.createSubmission({
      problemSlug,
      language: 'python',
      sourceCode: pythonSource
    })
    const secondCreated = await (await callerFor(second.id)).submission.createSubmission({
      problemSlug,
      language: 'cpp',
      sourceCode: 'int main(){}'
    })

    const anonymousTrpc = await caller()
    const feed = await anonymousTrpc.submission.listSubmissions({ problemSlug })

    expect(feed.page).toBe(1)
    expect(feed.pageSize).toBe(25)
    expect(feed.total).toBeGreaterThanOrEqual(2)
    expect(feed.submissions.map(row => row.id).slice(0, 2)).toEqual([
      secondCreated.id,
      firstCreated.id
    ])

    const [newest] = feed.submissions

    expect(newest.username).toBe(second.username)
    expect(newest.problemCode.length).toBeGreaterThan(0)
    expect(Object.keys(newest).sort()).toEqual([
      'createdAt',
      'id',
      'language',
      'problemCode',
      'problemSlug',
      'problemTitle',
      'status',
      'username'
    ])
  })

  it('pages', async () => {
    const author = await signIn('feed-paged')
    const trpc = await callerFor(author.id)

    await trpc.submission.createSubmission({ problemSlug, language: 'python', sourceCode: 'a=1\n' })
    await trpc.submission.createSubmission({ problemSlug, language: 'python', sourceCode: 'a=2\n' })

    const anonymousTrpc = await caller()
    const firstPage = await anonymousTrpc.submission.listSubmissions({ problemSlug, pageSize: 1 })
    const secondPage = await anonymousTrpc.submission.listSubmissions({
      problemSlug,
      page: 2,
      pageSize: 1
    })

    expect(firstPage.submissions).toHaveLength(1)
    expect(secondPage.submissions).toHaveLength(1)
    expect(secondPage.submissions[0].id).not.toBe(firstPage.submissions[0].id)
  })
})

describe('submission.listMySubmissions', () => {
  it('lists only your own solutions, with what they scored', async () => {
    const mine = await signIn('mine')
    const other = await signIn('other')

    const myCreated = await (await callerFor(mine.id)).submission.createSubmission({
      problemSlug,
      language: 'python',
      sourceCode: pythonSource
    })
    await (await callerFor(other.id)).submission.createSubmission({
      problemSlug,
      language: 'python',
      sourceCode: pythonSource
    })

    const myList = await (await callerFor(mine.id)).submission.listMySubmissions({})

    expect(myList.total).toBe(1)
    expect(myList.submissions).toHaveLength(1)
    expect(myList.submissions[0].id).toBe(myCreated.id)
    expect(myList.submissions[0].username).toBe(mine.username)
    expect(myList.submissions[0].score).toBeNull()
    expect(myList.submissions[0].maxScore).toBeNull()
    expect(Object.keys(myList.submissions[0])).not.toContain('sourceCode')
  })

  it('turns away a visitor who is not signed in', async () => {
    const trpc = await caller()

    await expect(trpc.submission.listMySubmissions({})).rejects.toMatchObject({
      code: 'UNAUTHORIZED'
    })
  })
})
