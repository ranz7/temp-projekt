import { db } from '@backend/database/db'
import { account__user_ } from '@backend/modules/account/schema'
import { closeSubmissionQueue } from '@backend/modules/submission/internal-functions/queue'
import { sweepSubmissions } from '@backend/modules/submission/internal-functions/sweeper'
import { submission__submission_ } from '@backend/modules/submission/schema'
import { task__problem_ } from '@backend/modules/task/schema'
import { eq, like, sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const slug = 'itest-sweeper-problem'
const username = 'itest-sweeper-author'
const pythonSource = 'print("YES")\n'

let authorId = ''
let problemId = ''

type QueuedRow = {
  status: 'queued' | 'running'
  attempts?: number
  leaseExpiresAt?: Date | null
  claimId?: string | null
  queuePublishedAt?: Date | null
}

async function insertSubmission(row: QueuedRow): Promise<string> {
  const [submission] = await db
    .insert(submission__submission_)
    .values({
      problem_id_: problemId,
      user_id_: authorId,
      language_: 'python',
      source_code_: pythonSource,
      status_: row.status,
      judge_attempts_: row.attempts ?? 0,
      lease_expires_at_: row.leaseExpiresAt ?? null,
      judge_claim_id_: row.claimId ?? null,
      queue_published_at_: row.queuePublishedAt ?? null
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

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000)
}

beforeAll(async () => {
  process.env.SUBMISSION_MAX_ATTEMPTS = '3'
  process.env.SUBMISSION_QUEUE_REPOST_SECONDS = '10'
  // Nothing listens here, so every wake-up fails - the outage the sweep must survive.
  process.env.REDIS_URL = 'redis://127.0.0.1:6399'

  await db.delete(task__problem_).where(eq(task__problem_.slug_, slug))
  await db.delete(account__user_).where(like(account__user_.username_, `${username}%`))

  const [author] = await db
    .insert(account__user_)
    .values({ username_: username })
    .returning({ id: account__user_.id })

  const [problem] = await db
    .insert(task__problem_)
    .values({
      slug_: slug,
      code_: 'ITEST-SWEEP',
      title_: 'Sweeper fixture',
      statement_: 'Statement',
      difficulty_: 'easy',
      tags_: [],
      languages_: ['python'],
      time_limit_ms_: 1000,
      memory_limit_mb_: 64,
      package_dir_: slug
    })
    .returning({ id: task__problem_.id })

  authorId = author.id
  problemId = problem.id
})

beforeEach(async () => {
  // The sweep looks at every submission, so this file needs the table to itself.
  await db.delete(submission__submission_).where(sql`true`)
})

afterAll(async () => {
  await db.delete(submission__submission_).where(sql`true`)
  await db.delete(task__problem_).where(eq(task__problem_.slug_, slug))
  await db.delete(account__user_).where(like(account__user_.username_, `${username}%`))
  closeSubmissionQueue()
})

describe('sweepSubmissions', () => {
  it('queues a submission again when its checker went quiet', async () => {
    const submissionId = await insertSubmission({
      status: 'running',
      attempts: 1,
      leaseExpiresAt: minutesAgo(5),
      claimId: '00000000-0000-4000-8000-000000000001'
    })

    const report = await sweepSubmissions()

    expect(report.requeued).toBe(1)
    expect(report.failed).toBe(0)

    const row = await readSubmission(submissionId)

    expect(row.status_).toBe('queued')
    expect(row.judge_claim_id_).toBeNull()
    expect(row.lease_expires_at_).toBeNull()
    // The attempt stays spent - three quiet checkers still end the submission.
    expect(row.judge_attempts_).toBe(1)
  })

  it('calls a submission an internal error once its attempts are gone', async () => {
    const submissionId = await insertSubmission({
      status: 'running',
      attempts: 3,
      leaseExpiresAt: minutesAgo(5),
      claimId: '00000000-0000-4000-8000-000000000002'
    })

    const report = await sweepSubmissions()

    expect(report.failed).toBe(1)

    const row = await readSubmission(submissionId)

    expect(row.status_).toBe('internal_error')
    expect(row.judged_at_).not.toBeNull()
    expect(row.judge_message_?.length ?? 0).toBeGreaterThan(0)
    expect(row.judge_claim_id_).toBeNull()
    expect(row.lease_expires_at_).toBeNull()
  })

  it('leaves a checker that is still within its lease alone', async () => {
    const submissionId = await insertSubmission({
      status: 'running',
      attempts: 1,
      leaseExpiresAt: new Date(Date.now() + 60_000),
      claimId: '00000000-0000-4000-8000-000000000003'
    })

    const report = await sweepSubmissions()

    expect(report.requeued).toBe(0)
    expect(report.failed).toBe(0)
    expect((await readSubmission(submissionId)).status_).toBe('running')
  })

  it('survives a wake-up channel that is down and keeps the submission waiting', async () => {
    const submissionId = await insertSubmission({ status: 'queued', queuePublishedAt: null })

    const report = await sweepSubmissions()

    expect(report.republished).toBe(0)

    const row = await readSubmission(submissionId)

    expect(row.status_).toBe('queued')
    // Still unannounced, so the next sweep tries again.
    expect(row.queue_published_at_).toBeNull()
  })
})
