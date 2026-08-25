import { type Database, db } from '@backend/database/db'
import {
  getMaxJudgeAttempts,
  getQueueRepostSeconds
} from '@backend/modules/submission/internal-functions/judging'
import { publishSubmissionWakeUp } from '@backend/modules/submission/internal-functions/queue'
import { submission__submission_ } from '@backend/modules/submission/schema'
import { and, eq, gte, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'

/** How many waiting submissions one sweep tries to wake a checker for. */
const REPUBLISH_BATCH_SIZE = 200

/** What a submission's page says once nobody managed to judge it. */
const EXHAUSTED_MESSAGE =
  'Judging did not finish after several attempts. Please submit the solution again.'

export type SweepReport = {
  /** Submissions whose checker went quiet and that now wait for another one. */
  requeued: number
  /** Submissions nobody managed to judge within their attempts. */
  failed: number
  /** Waiting submissions a checker was woken for again. */
  republished: number
}

function expiredLease() {
  return and(
    eq(submission__submission_.status_, 'running'),
    isNotNull(submission__submission_.lease_expires_at_),
    lt(submission__submission_.lease_expires_at_, sql`now()`)
  )
}

/**
 * Keeps lost work moving:
 * a claim whose worker went quiet goes back into the queue, a submission that ran out
 * of attempts is called an internal error, and a submission Redis never heard about is
 * announced again. Redis being down only skips the announcing.
 */
export async function sweepSubmissions(database: Database = db): Promise<SweepReport> {
  const maxAttempts = getMaxJudgeAttempts()

  const requeued = await database
    .update(submission__submission_)
    .set({
      status_: 'queued',
      judge_claim_id_: null,
      lease_expires_at_: null,
      // Forgetting the wake-up makes the republish step below announce it again.
      queue_published_at_: null
    })
    .where(and(expiredLease(), lt(submission__submission_.judge_attempts_, maxAttempts)))
    .returning({ id: submission__submission_.id })

  const failed = await database
    .update(submission__submission_)
    .set({
      status_: 'internal_error',
      judge_message_: EXHAUSTED_MESSAGE,
      judged_at_: sql`now()`,
      judge_claim_id_: null,
      lease_expires_at_: null
    })
    .where(and(expiredLease(), gte(submission__submission_.judge_attempts_, maxAttempts)))
    .returning({ id: submission__submission_.id })

  const unannounced = await database
    .select({ id: submission__submission_.id })
    .from(submission__submission_)
    .where(
      and(
        eq(submission__submission_.status_, 'queued'),
        or(
          isNull(submission__submission_.queue_published_at_),
          lt(
            submission__submission_.queue_published_at_,
            sql`now() - make_interval(secs => ${getQueueRepostSeconds()}::double precision)`
          )
        )
      )
    )
    .orderBy(submission__submission_.created_at_)
    .limit(REPUBLISH_BATCH_SIZE)

  let republished = 0

  for (const submission of unannounced) {
    try {
      const published = await publishSubmissionWakeUp(submission.id)

      if (!published) continue

      await database
        .update(submission__submission_)
        .set({ queue_published_at_: sql`now()` })
        .where(eq(submission__submission_.id, submission.id))

      republished += 1
    } catch (error) {
      // One unreachable channel never stops the sweep; the next one tries again.
      const reason = error instanceof Error ? error.message : String(error)

      console.warn(`[sweeper] Could not announce submission ${submission.id}: ${reason}`)
    }
  }

  return { requeued: requeued.length, failed: failed.length, republished }
}
