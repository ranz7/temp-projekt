import { type Database, db } from '@backend/database/db'
import type { CheckerFinalResultDTO } from '@backend/modules/machine/contract'
import { readPositiveInteger } from '@backend/modules/machine/internal-functions/settings'
import { machine__machine_ } from '@backend/modules/machine/schema'
import {
  PENDING_SUBMISSION_STATUSES,
  type SubmissionStatus,
  submission__submission_,
  submission__test_result_
} from '@backend/modules/submission/schema'
import { task__problem_test_ } from '@backend/modules/task/schema'
import { and, eq, isNotNull, lt, type SQL, sql } from 'drizzle-orm'

const DEFAULT_LEASE_SECONDS = 120
const DEFAULT_MAX_ATTEMPTS = 3

/** What a waiting submission's page says while no machine can take it. */
export const UNAVAILABLE_MESSAGE =
  'Checking is temporarily unavailable. This solution stays in the queue and will be judged.'

/** What a submission's page says once no machine managed to finish it. */
export const EXHAUSTED_MESSAGE =
  'Judging did not finish after several attempts. Please submit the solution again.'

/** How long a machine may hold a submission without answering for it. */
export function getLeaseSeconds(): number {
  return readPositiveInteger('SUBMISSION_LEASE_SECONDS', DEFAULT_LEASE_SECONDS)
}

/** How many times a submission may be handed out before it is called an error. */
export function getMaxJudgeAttempts(): number {
  return readPositiveInteger('SUBMISSION_MAX_ATTEMPTS', DEFAULT_MAX_ATTEMPTS)
}

export function leaseExpiry(): SQL {
  return sql`now() + make_interval(secs => ${getLeaseSeconds()}::double precision)`
}

function isPending(status: SubmissionStatus): boolean {
  return PENDING_SUBMISSION_STATUSES.some(pending => pending === status)
}

/** Every running submission whose machine has said nothing for too long. */
export function expiredLease(): SQL | undefined {
  return and(
    eq(submission__submission_.status_, 'running'),
    isNotNull(submission__submission_.lease_expires_at_),
    lt(submission__submission_.lease_expires_at_, sql`now()`)
  )
}

export type LossReport = {
  /** Submissions now waiting for another machine. */
  requeued: number
  /** Submissions nobody managed to judge within their attempts. */
  failed: number
}

/**
 * Takes running submissions away from the machines that were holding them.
 *
 * The attempt they already spent stays spent, so a submission that keeps losing its
 * machine ends as an internal error instead of circling forever.
 */
export async function loseRunningSubmissions(
  where: SQL | undefined,
  reason: string,
  database: Database = db
): Promise<LossReport> {
  const maxAttempts = getMaxJudgeAttempts()
  const exhausted = sql`${submission__submission_.judge_attempts_} >= ${maxAttempts}`

  const rows = await database
    .update(submission__submission_)
    .set({
      status_: sql`case when ${exhausted} then 'internal_error' else 'queued' end`,
      judge_message_: sql`case when ${exhausted} then ${EXHAUSTED_MESSAGE} else ${reason} end`,
      judged_at_: sql`case when ${exhausted} then now() else ${submission__submission_.judged_at_} end`,
      judge_claim_id_: null,
      lease_expires_at_: null,
      machine_id_: null,
      checker_job_id_: null
    })
    .where(and(eq(submission__submission_.status_, 'running'), where))
    .returning({ status: submission__submission_.status_ })

  return {
    requeued: rows.filter(row => row.status === 'queued').length,
    failed: rows.filter(row => row.status === 'internal_error').length
  }
}

/** Takes one submission away from the machine that was holding it. */
export function loseSubmission(
  submissionId: string,
  claimId: string,
  reason: string,
  database: Database = db
): Promise<LossReport> {
  return loseRunningSubmissions(
    and(
      eq(submission__submission_.id, submissionId),
      eq(submission__submission_.judge_claim_id_, claimId)
    ),
    reason,
    database
  )
}

/** Takes every submission a machine was holding away from it. */
export function loseSubmissionsOfMachine(
  machineId: string,
  reason: string,
  database: Database = db
): Promise<LossReport> {
  return loseRunningSubmissions(
    eq(submission__submission_.machine_id_, machineId),
    reason,
    database
  )
}

/** Gives back a claim nobody spent - a full or briefly silent machine costs no attempt. */
export async function undoClaim(
  submissionId: string,
  claimId: string,
  reason: string,
  database: Database = db
): Promise<void> {
  await database
    .update(submission__submission_)
    .set({
      status_: 'queued',
      judge_claim_id_: null,
      lease_expires_at_: null,
      machine_id_: null,
      checker_job_id_: null,
      // Not this submission's fault, so the attempt goes back.
      judge_attempts_: sql`greatest(${submission__submission_.judge_attempts_} - 1, 0)`,
      judge_message_: reason
    })
    .where(
      and(
        eq(submission__submission_.id, submissionId),
        eq(submission__submission_.judge_claim_id_, claimId),
        eq(submission__submission_.status_, 'running')
      )
    )
}

/** Pushes the lease out. Only the claim a machine still holds moves. */
export async function extendClaimLease(
  submissionId: string,
  claimId: string,
  database: Database = db
): Promise<void> {
  await database
    .update(submission__submission_)
    .set({ lease_expires_at_: leaseExpiry() })
    .where(
      and(
        eq(submission__submission_.id, submissionId),
        eq(submission__submission_.judge_claim_id_, claimId),
        eq(submission__submission_.status_, 'running')
      )
    )
}

/**
 * Writes what a machine finished. Fenced on the claim id, so a submission that was
 * re-queued and taken elsewhere is never overwritten by the slow original, and a
 * submission that already has a final status ignores anything later.
 *
 * @returns whether the result was written.
 */
export async function applyCheckerResult(
  submissionId: string,
  claimId: string,
  result: CheckerFinalResultDTO,
  database: Database = db
): Promise<boolean> {
  return database.transaction(async transaction => {
    const [current] = await transaction
      .select({
        id: submission__submission_.id,
        problemId: submission__submission_.problem_id_,
        machineId: submission__submission_.machine_id_,
        status: submission__submission_.status_,
        claimId: submission__submission_.judge_claim_id_
      })
      .from(submission__submission_)
      .where(eq(submission__submission_.id, submissionId))
      .limit(1)
      .for('update')

    if (!current) return false
    if (!isPending(current.status)) return false
    if (current.claimId !== claimId) return false

    const problemTests = await transaction
      .select({
        id: task__problem_test_.id,
        ordinal: task__problem_test_.ordinal_,
        visibility: task__problem_test_.visibility_
      })
      .from(task__problem_test_)
      .where(eq(task__problem_test_.problem_id_, current.problemId))

    // The machine numbers its rows within each block; we hold the ids. That is the
    // only thing the two sides have to agree on.
    const knownTests = new Map(
      problemTests.map(test => [`${test.visibility}:${test.ordinal}`, test])
    )

    const rows = result.tests.flatMap(test => {
      const problemTest = knownTests.get(`${test.visibility}:${test.ordinal}`)

      if (problemTest === undefined) return []

      return [
        {
          submission_id_: current.id,
          problem_test_id_: problemTest.id,
          ordinal_: problemTest.ordinal,
          visibility_: problemTest.visibility,
          verdict_: test.verdict,
          passed_: test.passed,
          points_awarded_: Math.round(test.pointsAwarded),
          message_: test.message ?? null,
          actual_output_: test.actualOutput ?? null,
          time_ms_: test.timeMs,
          memory_kb_: test.memoryKb,
          presses_: test.presses ?? null
        }
      ]
    })

    await transaction
      .delete(submission__test_result_)
      .where(eq(submission__test_result_.submission_id_, current.id))

    if (rows.length > 0) await transaction.insert(submission__test_result_).values(rows)

    await transaction
      .update(submission__submission_)
      .set({
        status_: result.status,
        score_: Math.round(result.score),
        max_score_: Math.round(result.maxScore),
        compile_message_: result.compileMessage ?? null,
        // A judged submission waits on nothing, so any "unavailable" note goes.
        judge_message_: null,
        max_cpu_ms_: result.maxCpuMs,
        max_memory_kb_: result.maxMemoryKb,
        judged_at_: sql`now()`,
        lease_expires_at_: null,
        judge_claim_id_: null,
        checker_job_id_: null
      })
      .where(eq(submission__submission_.id, current.id))

    if (current.machineId !== null) {
      await transaction
        .update(machine__machine_)
        .set({ judged_total_: sql`${machine__machine_.judged_total_} + 1` })
        .where(eq(machine__machine_.id, current.machineId))
    }

    return true
  })
}
