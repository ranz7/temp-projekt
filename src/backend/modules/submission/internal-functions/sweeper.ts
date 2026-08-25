import { type Database, db } from '@backend/database/db'
import {
  EXHAUSTED_MESSAGE,
  expiredLease,
  getMaxJudgeAttempts,
  loseRunningSubmissions
} from '@backend/modules/submission/internal-functions/judging'
import { submission__submission_ } from '@backend/modules/submission/schema'
import { and, eq, gte, sql } from 'drizzle-orm'

/** What a submission's page says once its machine stopped answering for it. */
const SILENT_MACHINE_MESSAGE =
  'The machine judging this solution stopped answering. It is waiting for another one.'

export type SweepReport = {
  /** Submissions whose machine went quiet and that now wait for another one. */
  requeued: number
  /** Submissions nobody managed to judge within their attempts. */
  failed: number
}

/**
 * Keeps lost work moving: a submission whose machine went quiet past its lease goes back
 * into the queue, and one that has run out of attempts is called an internal error.
 */
export async function sweepSubmissions(database: Database = db): Promise<SweepReport> {
  const lost = await loseRunningSubmissions(expiredLease(), SILENT_MACHINE_MESSAGE, database)

  // A waiting submission that already used every attempt would never be handed out again.
  const stuck = await database
    .update(submission__submission_)
    .set({
      status_: 'internal_error',
      judge_message_: EXHAUSTED_MESSAGE,
      judged_at_: sql`now()`,
      judge_claim_id_: null,
      lease_expires_at_: null,
      checker_job_id_: null
    })
    .where(
      and(
        eq(submission__submission_.status_, 'queued'),
        gte(submission__submission_.judge_attempts_, getMaxJudgeAttempts())
      )
    )
    .returning({ id: submission__submission_.id })

  return { requeued: lost.requeued, failed: lost.failed + stuck.length }
}
