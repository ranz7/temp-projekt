import { randomUUID } from 'node:crypto'
import { type Database, db } from '@backend/database/db'
import {
  askMachineToJudge,
  type CheckerEndpoint
} from '@backend/modules/machine/internal-functions/checker-client'
import { machine__machine_ } from '@backend/modules/machine/schema'
import {
  getMaxJudgeAttempts,
  leaseExpiry,
  UNAVAILABLE_MESSAGE,
  undoClaim
} from '@backend/modules/submission/internal-functions/judging'
import { submission__submission_ } from '@backend/modules/submission/schema'
import { task__problem_ } from '@backend/modules/task/schema'
import { and, asc, eq, inArray, isNotNull, lt, ne, or, sql } from 'drizzle-orm'

/** How many waiting submissions one pass tries to hand out. */
const DISPATCH_BATCH_SIZE = 50

export type DispatchReport = {
  /** Submissions a machine took. */
  dispatched: number
  /** Submissions a machine refused, back in the queue with their attempt returned. */
  refused: number
  /** Submissions nobody could take, still waiting. */
  waiting: number
}

type FreeMachine = CheckerEndpoint & {
  problems: string[]
  spare: number
}

/**
 * The machines that could take work right now: enabled, reachable, and with room.
 * Room is whichever is worse - what the machine last said about itself, or what we
 * know we have already given it.
 */
async function findFreeMachines(database: Database): Promise<FreeMachine[]> {
  const machines = await database
    .select({
      id: machine__machine_.id,
      name: machine__machine_.name_,
      localPort: machine__machine_.local_port_,
      capacity: machine__machine_.capacity_,
      busy: machine__machine_.busy_,
      problems: machine__machine_.problems_
    })
    .from(machine__machine_)
    .where(and(eq(machine__machine_.enabled_, true), eq(machine__machine_.reachable_, true)))
    .orderBy(asc(machine__machine_.name_))

  const inFlight = await database
    .select({
      machineId: submission__submission_.machine_id_,
      held: sql<number>`count(*)::int`
    })
    .from(submission__submission_)
    .where(
      and(
        eq(submission__submission_.status_, 'running'),
        isNotNull(submission__submission_.machine_id_)
      )
    )
    .groupBy(submission__submission_.machine_id_)

  const heldByMachine = new Map(inFlight.map(row => [row.machineId, row.held]))

  return machines
    .map(machine => ({
      id: machine.id,
      name: machine.name,
      localPort: machine.localPort,
      problems: machine.problems,
      spare: machine.capacity - Math.max(machine.busy, heldByMachine.get(machine.id) ?? 0)
    }))
    .filter(machine => machine.spare > 0)
}

/** The emptiest machine that has this problem's package on its disk. */
function chooseMachine(machines: FreeMachine[], packageDirectory: string): FreeMachine | null {
  const able = machines.filter(
    machine => machine.spare > 0 && machine.problems.includes(packageDirectory)
  )

  if (able.length === 0) return null

  return able.reduce((best, machine) => (machine.spare > best.spare ? machine : best))
}

/**
 * Hands waiting submissions to machines, oldest first.
 *
 * A submission is claimed by one guarded `UPDATE ... RETURNING`, so two passes running
 * at the same time can never both take it. A machine that is full or briefly silent has
 * the claim undone and its attempt given back - only real judging spends an attempt.
 */
export async function dispatchQueuedSubmissions(database: Database = db): Promise<DispatchReport> {
  const report: DispatchReport = { dispatched: 0, refused: 0, waiting: 0 }
  const machines = await findFreeMachines(database)

  const queued = await database
    .select({
      id: submission__submission_.id,
      language: submission__submission_.language_,
      sourceCode: submission__submission_.source_code_,
      problemSlug: task__problem_.slug_,
      packageDirectory: task__problem_.package_dir_
    })
    .from(submission__submission_)
    .innerJoin(task__problem_, eq(task__problem_.id, submission__submission_.problem_id_))
    .where(
      and(
        eq(submission__submission_.status_, 'queued'),
        lt(submission__submission_.judge_attempts_, getMaxJudgeAttempts())
      )
    )
    .orderBy(asc(submission__submission_.created_at_), asc(submission__submission_.id))
    .limit(DISPATCH_BATCH_SIZE)

  if (queued.length === 0) return report

  const stillWaiting: string[] = []

  for (const submission of queued) {
    const machine = chooseMachine(machines, submission.packageDirectory)

    if (machine === null) {
      stillWaiting.push(submission.id)

      continue
    }

    const claimId = randomUUID()

    // The one place a submission changes hands. Guarded on `queued`, so a second
    // dispatcher pass finds nothing to update and moves on.
    const claimed = await database
      .update(submission__submission_)
      .set({
        status_: 'running',
        judge_claim_id_: claimId,
        machine_id_: machine.id,
        checker_job_id_: null,
        lease_expires_at_: leaseExpiry(),
        judge_attempts_: sql`${submission__submission_.judge_attempts_} + 1`,
        judge_message_: null
      })
      .where(
        and(
          eq(submission__submission_.id, submission.id),
          eq(submission__submission_.status_, 'queued')
        )
      )
      .returning({ id: submission__submission_.id })

    if (claimed.length === 0) continue

    const outcome = await askMachineToJudge(machine, {
      submissionId: submission.id,
      problemSlug: submission.problemSlug,
      packageDirectory: submission.packageDirectory,
      language: submission.language,
      sourceCode: submission.sourceCode
    })

    if (!outcome.accepted) {
      await undoClaim(submission.id, claimId, UNAVAILABLE_MESSAGE, database)

      // This machine takes nothing else this pass.
      machine.spare = 0
      report.refused += 1
      stillWaiting.push(submission.id)

      continue
    }

    await database
      .update(submission__submission_)
      .set({ checker_job_id_: outcome.jobId, lease_expires_at_: leaseExpiry() })
      .where(
        and(
          eq(submission__submission_.id, submission.id),
          eq(submission__submission_.judge_claim_id_, claimId)
        )
      )

    machine.spare -= 1
    report.dispatched += 1
  }

  if (stillWaiting.length > 0) {
    // Waiting is not failing: the page says so and the submission keeps its place.
    await database
      .update(submission__submission_)
      .set({ judge_message_: UNAVAILABLE_MESSAGE })
      .where(
        and(
          inArray(submission__submission_.id, stillWaiting),
          eq(submission__submission_.status_, 'queued'),
          or(
            sql`${submission__submission_.judge_message_} is null`,
            ne(submission__submission_.judge_message_, UNAVAILABLE_MESSAGE)
          )
        )
      )

    report.waiting = stillWaiting.length
  }

  return report
}
