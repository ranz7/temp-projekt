import { type Database, db } from '@backend/database/db'
import { askMachineForJob } from '@backend/modules/machine/internal-functions/checker-client'
import { machine__machine_ } from '@backend/modules/machine/schema'
import {
  applyCheckerResult,
  extendClaimLease,
  loseSubmission
} from '@backend/modules/submission/internal-functions/judging'
import { submission__submission_ } from '@backend/modules/submission/schema'
import { and, asc, eq, isNotNull } from 'drizzle-orm'

/** How many running submissions one pass asks after. */
const COLLECT_BATCH_SIZE = 100

export type CollectReport = {
  /** Submissions a machine finished. */
  finished: number
  /** Submissions still being judged. */
  running: number
  /** Submissions whose machine forgot them or went quiet, now waiting again. */
  requeued: number
  /** Submissions nobody managed to judge within their attempts. */
  failed: number
}

/**
 * Asks every machine what became of the submissions it holds, and writes back what it
 * says. A machine that forgets a job or stops answering hands the submission back to
 * the queue; the attempt it already spent stays spent.
 */
export async function collectSubmissionResults(database: Database = db): Promise<CollectReport> {
  const report: CollectReport = { finished: 0, running: 0, requeued: 0, failed: 0 }

  const running = await database
    .select({
      id: submission__submission_.id,
      claimId: submission__submission_.judge_claim_id_,
      jobId: submission__submission_.checker_job_id_,
      machineId: machine__machine_.id,
      machineName: machine__machine_.name_,
      localPort: machine__machine_.local_port_
    })
    .from(submission__submission_)
    .innerJoin(machine__machine_, eq(machine__machine_.id, submission__submission_.machine_id_))
    .where(
      and(
        eq(submission__submission_.status_, 'running'),
        isNotNull(submission__submission_.judge_claim_id_),
        isNotNull(submission__submission_.checker_job_id_)
      )
    )
    .orderBy(asc(submission__submission_.created_at_))
    .limit(COLLECT_BATCH_SIZE)

  for (const submission of running) {
    const { claimId, jobId } = submission

    if (claimId === null || jobId === null) continue

    const machine = {
      id: submission.machineId,
      name: submission.machineName,
      localPort: submission.localPort
    }

    const outcome = await askMachineForJob(machine, jobId)

    if (outcome.kind === 'running') {
      await extendClaimLease(submission.id, claimId, database)
      report.running += 1

      continue
    }

    if (outcome.kind === 'done') {
      const written = await applyCheckerResult(submission.id, claimId, outcome.result, database)

      if (written) report.finished += 1

      continue
    }

    const lost = await loseSubmission(submission.id, claimId, outcome.reason, database)

    report.requeued += lost.requeued
    report.failed += lost.failed
  }

  return report
}
