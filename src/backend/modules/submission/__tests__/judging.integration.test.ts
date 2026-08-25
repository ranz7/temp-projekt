import { db } from '@backend/database/db'
import { account__user_ } from '@backend/modules/account/schema'
import { type ClaimedJobDTO, ClaimJobResponseDTOZ } from '@backend/modules/submission/contract'
import { forgetStickyProblems } from '@backend/modules/submission/internal-functions/judging'
import { closeSubmissionQueue } from '@backend/modules/submission/internal-functions/queue'
import {
  submission__submission_,
  submission__test_result_
} from '@backend/modules/submission/schema'
import { task__problem_, task__problem_test_ } from '@backend/modules/task/schema'
import { eq, like, sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { POST as claimRoute } from '@/app/api/internal/checker/claim/route'
import { POST as heartbeatRoute } from '@/app/api/internal/checker/heartbeat/route'
import { POST as releaseRoute } from '@/app/api/internal/checker/release/route'
import { POST as resultRoute } from '@/app/api/internal/checker/result/route'

const serviceKey = 'itest-judging-service-key'
const wrongServiceKey = 'itest-judging-wrong-key-x'
const slugPrefix = 'itest-judging-'
const username = 'itest-judging-author'
const pythonSource = 'print("YES")\n'
const sampleInput = '8\n'
const sampleOutput = 'YES\n'
/** Hidden test data that must never reach a worker over HTTP. */
const hiddenSecret = 'HIDDEN-TEST-DATA-MUST-NEVER-LEAVE'

type RouteHandler = (request: Request) => Promise<Response>

type CheckerCall = {
  status: number
  payload: unknown
}

let authorId = ''
let firstProblemId = ''
let secondProblemId = ''
let publicTestId = ''
let hiddenTestId = ''

async function post(
  handler: RouteHandler,
  body: unknown,
  key: string | null = serviceKey
): Promise<CheckerCall> {
  const headers = new Headers({ 'content-type': 'application/json' })

  if (key !== null) headers.set('x-service-key', key)

  const response = await handler(
    new Request('http://127.0.0.1/api/internal/checker', {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })
  )

  return { status: response.status, payload: await response.json() }
}

async function claim(workerId = 'itest-worker'): Promise<ClaimedJobDTO | null> {
  const call = await post(claimRoute, {
    contractVersion: 1,
    workerId,
    languages: ['python', 'cpp']
  })

  expect(call.status).toBe(200)

  return ClaimJobResponseDTOZ.parse(call.payload).job
}

async function claimedJob(workerId = 'itest-worker'): Promise<ClaimedJobDTO> {
  const job = await claim(workerId)

  if (job === null) throw new Error('Expected a job to claim.')

  return job
}

async function createProblem(slug: string, withTests: boolean): Promise<string> {
  const [problem] = await db
    .insert(task__problem_)
    .values({
      slug_: slug,
      code_: slug.toUpperCase(),
      title_: `Judging fixture ${slug}`,
      statement_: 'Statement',
      difficulty_: 'easy',
      tags_: [],
      languages_: ['python', 'cpp'],
      time_limit_ms_: 1000,
      memory_limit_mb_: 64,
      checker_type_: 'token',
      package_dir_: slug
    })
    .returning({ id: task__problem_.id })

  if (!withTests) return problem.id

  const tests = await db
    .insert(task__problem_test_)
    .values([
      {
        problem_id_: problem.id,
        ordinal_: 1,
        visibility_: 'public',
        input_: sampleInput,
        expected_output_: sampleOutput,
        points_: 0
      },
      {
        problem_id_: problem.id,
        ordinal_: 1,
        visibility_: 'hidden',
        // Stored on purpose so the test proves the payload leaves it behind.
        input_: hiddenSecret,
        expected_output_: hiddenSecret,
        input_member_: '001.in',
        output_member_: '001.out',
        points_: 5
      }
    ])
    .returning({ id: task__problem_test_.id, visibility: task__problem_test_.visibility_ })

  publicTestId = tests.filter(test => test.visibility === 'public')[0].id
  hiddenTestId = tests.filter(test => test.visibility === 'hidden')[0].id

  return problem.id
}

async function queueSubmission(problemId: string, createdAt: Date): Promise<string> {
  const [submission] = await db
    .insert(submission__submission_)
    .values({
      problem_id_: problemId,
      user_id_: authorId,
      language_: 'python',
      source_code_: pythonSource,
      status_: 'queued',
      created_at_: createdAt
    })
    .returning({ id: submission__submission_.id })

  return submission.id
}

async function readSubmission(id: string) {
  const [row] = await db
    .select()
    .from(submission__submission_)
    .where(eq(submission__submission_.id, id))

  return row
}

async function readTestResults(id: string) {
  return db
    .select()
    .from(submission__test_result_)
    .where(eq(submission__test_result_.submission_id_, id))
}

beforeAll(async () => {
  process.env.SERVICE_KEY = serviceKey
  process.env.SUBMISSION_LEASE_SECONDS = '60'
  process.env.SUBMISSION_MAX_ATTEMPTS = '3'
  // Nothing listens here: judging never needs the wake-up channel.
  process.env.REDIS_URL = 'redis://127.0.0.1:6399'

  await db.delete(task__problem_).where(like(task__problem_.slug_, `${slugPrefix}%`))
  await db.delete(account__user_).where(eq(account__user_.username_, username))

  const [author] = await db
    .insert(account__user_)
    .values({ username_: username })
    .returning({ id: account__user_.id })

  authorId = author.id
  firstProblemId = await createProblem(`${slugPrefix}first`, true)
  secondProblemId = await createProblem(`${slugPrefix}second`, false)
})

beforeEach(async () => {
  // Claiming looks at every waiting submission, so this file needs the queue to itself.
  await db.delete(submission__submission_).where(sql`true`)
  forgetStickyProblems()
})

afterAll(async () => {
  await db.delete(submission__submission_).where(sql`true`)
  await db.delete(task__problem_).where(like(task__problem_.slug_, `${slugPrefix}%`))
  await db.delete(account__user_).where(eq(account__user_.username_, username))
  closeSubmissionQueue()
})

describe('checker authentication', () => {
  it('turns away a caller with no key or the wrong key and leaves the queue alone', async () => {
    const submissionId = await queueSubmission(firstProblemId, new Date())
    const body = { contractVersion: 1, workerId: 'itest-worker', languages: ['python'] }

    const missing = await post(claimRoute, body, null)
    const wrong = await post(claimRoute, body, wrongServiceKey)

    expect(missing.status).toBe(401)
    expect(wrong.status).toBe(401)

    const row = await readSubmission(submissionId)

    expect(row.status_).toBe('queued')
    expect(row.judge_attempts_).toBe(0)
    expect(row.judge_claim_id_).toBeNull()
  })

  it('refuses a contract version it does not speak', async () => {
    const submissionId = await queueSubmission(firstProblemId, new Date())

    const call = await post(claimRoute, {
      contractVersion: 2,
      workerId: 'itest-worker',
      languages: ['python']
    })

    expect(call.status).toBe(400)
    expect((await readSubmission(submissionId)).status_).toBe('queued')
  })
})

describe('claim', () => {
  it('leases one waiting submission and then has nothing left', async () => {
    const submissionId = await queueSubmission(firstProblemId, new Date())

    const job = await claimedJob()

    expect(job.submissionId).toBe(submissionId)
    expect(job.problemSlug).toBe(`${slugPrefix}first`)
    expect(job.language).toBe('python')
    expect(job.sourceCode).toBe(pythonSource)
    expect(job.timeLimitMs).toBe(1000)
    expect(job.memoryLimitMb).toBe(64)
    expect(job.checkerType).toBe('token')
    expect(job.checkerPath).toBeNull()

    const row = await readSubmission(submissionId)

    expect(row.status_).toBe('running')
    expect(row.judge_claim_id_).toBe(job.claimId)
    expect(row.judge_attempts_).toBe(1)
    expect(row.lease_expires_at_?.getTime() ?? 0).toBeGreaterThan(Date.now())

    expect(await claim()).toBeNull()
  })

  it('gives one waiting submission to exactly one of two workers racing for it', async () => {
    await queueSubmission(firstProblemId, new Date())

    const [first, second] = await Promise.all([claim('itest-worker-a'), claim('itest-worker-b')])
    const winners = [first, second].filter(job => job !== null)

    expect(winners).toHaveLength(1)
  })

  it('skips a submission whose attempts are used up', async () => {
    const submissionId = await queueSubmission(firstProblemId, new Date())

    await db
      .update(submission__submission_)
      .set({ judge_attempts_: 3 })
      .where(eq(submission__submission_.id, submissionId))

    expect(await claim()).toBeNull()
  })

  it('sends the sample data and never anything a hidden test holds', async () => {
    await queueSubmission(firstProblemId, new Date())

    const job = await claimedJob()

    expect(job.tests).toHaveLength(2)

    const [sample, hidden] = job.tests

    expect(sample.visibility).toBe('public')
    expect(sample.visibility === 'public' && sample.input).toBe(sampleInput)
    expect(sample.visibility === 'public' && sample.expectedOutput).toBe(sampleOutput)
    expect(hidden.visibility).toBe('hidden')
    expect(hidden.visibility === 'hidden' && hidden.inputFile).toBe('001.in')
    expect(hidden.visibility === 'hidden' && hidden.outputFile).toBe('001.out')
    expect(Object.keys(hidden).sort()).toEqual([
      'inputFile',
      'ordinal',
      'outputFile',
      'points',
      'problemTestId',
      'visibility'
    ])
    expect(JSON.stringify(job)).not.toContain(hiddenSecret)
  })

  it('keeps draining the problem a worker last judged', async () => {
    const olderOtherProblem = await queueSubmission(
      secondProblemId,
      new Date('2026-01-01T10:00:00Z')
    )
    const firstOfProblem = await queueSubmission(firstProblemId, new Date('2026-01-01T09:00:00Z'))

    // Oldest first, so the worker starts on the problem it will then stick to.
    expect((await claimedJob('sticky-worker')).submissionId).toBe(firstOfProblem)

    const newerSameProblem = await queueSubmission(firstProblemId, new Date('2026-01-01T11:00:00Z'))

    const next = await claimedJob('sticky-worker')

    expect(next.submissionId).toBe(newerSameProblem)

    // A worker with no history takes the oldest one instead.
    expect((await claimedJob('fresh-worker')).submissionId).toBe(olderOtherProblem)
  })
})

describe('heartbeat', () => {
  it('pushes the lease out for the active claim only', async () => {
    const submissionId = await queueSubmission(firstProblemId, new Date())
    const job = await claimedJob()
    const staleLease = new Date('2026-01-01T00:00:00Z')

    await db
      .update(submission__submission_)
      .set({ lease_expires_at_: staleLease })
      .where(eq(submission__submission_.id, submissionId))

    const stale = await post(heartbeatRoute, {
      contractVersion: 1,
      submissionId,
      claimId: '00000000-0000-4000-8000-000000000001'
    })

    expect(stale.status).toBe(200)
    expect((await readSubmission(submissionId)).lease_expires_at_?.getTime()).toBe(
      staleLease.getTime()
    )

    const live = await post(heartbeatRoute, {
      contractVersion: 1,
      submissionId,
      claimId: job.claimId
    })

    expect(live.status).toBe(200)
    expect((await readSubmission(submissionId)).lease_expires_at_?.getTime() ?? 0).toBeGreaterThan(
      Date.now()
    )
  })
})

describe('result', () => {
  it('writes the verdict, the score and one row per test', async () => {
    const submissionId = await queueSubmission(firstProblemId, new Date())
    const job = await claimedJob()

    const running = await post(resultRoute, {
      contractVersion: 1,
      submissionId,
      claimId: job.claimId,
      status: 'running'
    })

    expect(running.status).toBe(200)
    expect((await readSubmission(submissionId)).status_).toBe('running')

    const call = await post(resultRoute, {
      contractVersion: 1,
      submissionId,
      claimId: job.claimId,
      status: 'accepted',
      score: 5,
      maxScore: 5,
      compileMessage: null,
      maxCpuMs: 12,
      maxMemoryKb: 4096,
      tests: [
        {
          problemTestId: publicTestId,
          ordinal: 1,
          verdict: 'passed',
          passed: true,
          pointsAwarded: 0,
          message: null,
          actualOutput: sampleOutput,
          timeMs: 10,
          memoryKb: 2048
        },
        {
          problemTestId: hiddenTestId,
          ordinal: 2,
          verdict: 'passed',
          passed: true,
          pointsAwarded: 5,
          message: null,
          actualOutput: 'YES',
          timeMs: 12,
          memoryKb: 4096
        }
      ]
    })

    expect(call.status).toBe(200)

    const row = await readSubmission(submissionId)

    expect(row.status_).toBe('accepted')
    expect(row.score_).toBe(5)
    expect(row.max_score_).toBe(5)
    expect(row.max_cpu_ms_).toBe(12)
    expect(row.max_memory_kb_).toBe(4096)
    expect(row.judged_at_).not.toBeNull()
    expect(row.judge_claim_id_).toBeNull()
    expect(row.lease_expires_at_).toBeNull()
    expect(row.judge_message_).toBeNull()

    const results = await readTestResults(submissionId)

    expect(results).toHaveLength(2)
    // Number and visibility come from the problem, not from the worker's report.
    expect(results.filter(test => test.visibility_ === 'hidden')[0].ordinal_).toBe(1)
    expect(results.filter(test => test.visibility_ === 'hidden')[0].points_awarded_).toBe(5)
  })

  it('ignores a second final report and does not duplicate the test rows', async () => {
    const submissionId = await queueSubmission(firstProblemId, new Date())
    const job = await claimedJob()

    const finalReport = {
      contractVersion: 1,
      submissionId,
      claimId: job.claimId,
      score: 5,
      maxScore: 5,
      compileMessage: null,
      maxCpuMs: 12,
      maxMemoryKb: 4096,
      tests: [
        {
          problemTestId: hiddenTestId,
          ordinal: 1,
          verdict: 'passed',
          passed: true,
          pointsAwarded: 5,
          message: null,
          actualOutput: null,
          timeMs: 10,
          memoryKb: 2048
        }
      ]
    }

    await post(resultRoute, { ...finalReport, status: 'accepted' })

    const second = await post(resultRoute, {
      ...finalReport,
      status: 'wrong_answer',
      score: 0,
      tests: [
        {
          ...finalReport.tests[0],
          verdict: 'wrong_answer',
          passed: false,
          pointsAwarded: 0
        }
      ]
    })

    expect(second.status).toBe(200)

    const row = await readSubmission(submissionId)
    const results = await readTestResults(submissionId)

    expect(row.status_).toBe('accepted')
    expect(row.score_).toBe(5)
    expect(results).toHaveLength(1)
    expect(results[0].verdict_).toBe('passed')
  })

  it('ignores a worker whose claim was taken over by another one', async () => {
    const submissionId = await queueSubmission(firstProblemId, new Date())
    const lost = await claimedJob('slow-worker')

    // The sweeper found the lease expired and put the submission back.
    await db
      .update(submission__submission_)
      .set({ status_: 'queued', judge_claim_id_: null, lease_expires_at_: null })
      .where(eq(submission__submission_.id, submissionId))

    const current = await claimedJob('fast-worker')

    expect(current.claimId).not.toBe(lost.claimId)

    const late = await post(resultRoute, {
      contractVersion: 1,
      submissionId,
      claimId: lost.claimId,
      status: 'wrong_answer',
      score: 0,
      maxScore: 5,
      compileMessage: null,
      maxCpuMs: 1,
      maxMemoryKb: 1,
      tests: []
    })

    expect(late.status).toBe(200)

    const row = await readSubmission(submissionId)

    expect(row.status_).toBe('running')
    expect(row.judge_claim_id_).toBe(current.claimId)
    expect(await readTestResults(submissionId)).toHaveLength(0)
  })
})

describe('release', () => {
  it('puts the submission back without spending an attempt', async () => {
    const submissionId = await queueSubmission(firstProblemId, new Date())
    const attemptsBefore = (await readSubmission(submissionId)).judge_attempts_
    const job = await claimedJob()

    expect((await readSubmission(submissionId)).judge_attempts_).toBe(attemptsBefore + 1)

    const call = await post(releaseRoute, {
      contractVersion: 1,
      submissionId,
      claimId: job.claimId,
      reason: 'OIOIOI is unreachable'
    })

    expect(call.status).toBe(200)

    const row = await readSubmission(submissionId)

    expect(row.status_).toBe('queued')
    expect(row.judge_attempts_).toBe(attemptsBefore)
    expect(row.judge_claim_id_).toBeNull()
    expect(row.lease_expires_at_).toBeNull()
    expect(row.judge_message_).toBe('OIOIOI is unreachable')
    expect(row.queue_published_at_).toBeNull()
  })

  it('leaves a submission that already has a final result alone', async () => {
    const submissionId = await queueSubmission(firstProblemId, new Date())
    const job = await claimedJob()

    await post(resultRoute, {
      contractVersion: 1,
      submissionId,
      claimId: job.claimId,
      status: 'accepted',
      score: 5,
      maxScore: 5,
      compileMessage: null,
      maxCpuMs: 1,
      maxMemoryKb: 1,
      tests: []
    })

    const call = await post(releaseRoute, {
      contractVersion: 1,
      submissionId,
      claimId: job.claimId,
      reason: 'OIOIOI is unreachable'
    })

    expect(call.status).toBe(200)

    const row = await readSubmission(submissionId)

    expect(row.status_).toBe('accepted')
    expect(row.judge_message_).toBeNull()
  })
})
