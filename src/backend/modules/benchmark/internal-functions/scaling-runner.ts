import { type Database, db } from '@backend/database/db'
import { runBenchmarkBatch } from '@backend/modules/benchmark/internal-functions/batch-runner'
import {
  benchmark__batch_,
  benchmark__batch_submission_,
  benchmark__scaling_run_,
  benchmark__scaling_step_
} from '@backend/modules/benchmark/schema'
import { machine__machine_ } from '@backend/modules/machine/schema'
import {
  PENDING_SUBMISSION_STATUSES,
  submission__submission_
} from '@backend/modules/submission/schema'
import { task__problem_ } from '@backend/modules/task/schema'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { findBenchmarkSolutionSet } from './solutions'

/** How often a step checks whether its solutions have all been judged. */
const STEP_POLL_INTERVAL_MS = 400

/** A step that has not finished in this long is treated as stuck and ends the run. */
const STEP_TIMEOUT_MS = 10 * 60 * 1000

/** Machines need a moment to be seen as enabled again before work is handed out. */
const SETTLE_MS = 1200

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

async function isStillRunning(database: Database, runId: string): Promise<boolean> {
  const [run] = await database
    .select({ status: benchmark__scaling_run_.status_ })
    .from(benchmark__scaling_run_)
    .where(eq(benchmark__scaling_run_.id, runId))
    .limit(1)

  return run?.status === 'running'
}

/**
 * The machines a run climbs through, in a fixed order so every step adds the next one
 * rather than a different one each time. Only machines that were answering when the
 * run started take part.
 */
export async function listRunnableMachines(
  database: Database
): Promise<{ id: string; enabled: boolean }[]> {
  return database
    .select({ id: machine__machine_.id, enabled: machine__machine_.enabled_ })
    .from(machine__machine_)
    .where(eq(machine__machine_.reachable_, true))
    .orderBy(asc(machine__machine_.name_))
}

/** Leaves exactly the first `count` machines of the run working and turns the rest off. */
async function keepOnlyFirst(
  database: Database,
  machineIds: string[],
  count: number
): Promise<void> {
  const working = machineIds.slice(0, count)
  const resting = machineIds.slice(count)

  if (working.length > 0) {
    await database
      .update(machine__machine_)
      .set({ enabled_: true })
      .where(inArray(machine__machine_.id, working))
  }

  if (resting.length > 0) {
    await database
      .update(machine__machine_)
      .set({ enabled_: false })
      .where(inArray(machine__machine_.id, resting))
  }
}

/** Waits until every solution of a step has a verdict, or gives up and says so. */
async function waitForStep(database: Database, runId: string, batchId: string): Promise<void> {
  const startedAt = Date.now()

  while (true) {
    const [pending] = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(benchmark__batch_submission_)
      .innerJoin(
        submission__submission_,
        eq(submission__submission_.id, benchmark__batch_submission_.submission_id_)
      )
      .where(
        and(
          eq(benchmark__batch_submission_.batch_id_, batchId),
          inArray(submission__submission_.status_, [...PENDING_SUBMISSION_STATUSES])
        )
      )

    if ((pending?.count ?? 0) === 0) return

    if (!(await isStillRunning(database, runId))) return

    if (Date.now() - startedAt > STEP_TIMEOUT_MS) {
      throw new Error(
        'A step did not finish in ten minutes. The machines it was using stopped answering.'
      )
    }

    await delay(STEP_POLL_INTERVAL_MS)
  }
}

/**
 * Measures how the judge scales: the same pile of correct solutions is sent to one
 * machine, then to two, and so on up the fleet, and each round is timed by the
 * judge's own timestamps.
 *
 * Whatever happens, every machine that was working when the run started is working
 * again when it ends - a measurement must not leave the fleet switched off.
 */
export async function runScalingRun(runId: string, database: Database = db): Promise<void> {
  const [run] = await database
    .select({
      status: benchmark__scaling_run_.status_,
      problemId: benchmark__scaling_run_.problem_id_,
      problemSlug: task__problem_.slug_,
      language: benchmark__scaling_run_.language_,
      perStep: benchmark__scaling_run_.submissions_per_step_,
      maxMachines: benchmark__scaling_run_.max_machines_
    })
    .from(benchmark__scaling_run_)
    .innerJoin(task__problem_, eq(task__problem_.id, benchmark__scaling_run_.problem_id_))
    .where(eq(benchmark__scaling_run_.id, runId))
    .limit(1)

  if (run?.status !== 'running') return

  if (findBenchmarkSolutionSet(run.problemSlug) === null) {
    throw new Error(`No reference solutions ship for ${run.problemSlug}.`)
  }

  const machines = await listRunnableMachines(database)
  const machineIds = machines.map(machine => machine.id)
  const wereEnabled = machines.filter(machine => machine.enabled).map(machine => machine.id)
  const rungs = Math.min(run.maxMachines, machineIds.length)

  if (rungs === 0) {
    throw new Error('No machine is answering, so there is nothing to measure.')
  }

  try {
    for (let count = 1; count <= rungs; count += 1) {
      if (!(await isStillRunning(database, runId))) return

      await keepOnlyFirst(database, machineIds, count)
      await delay(SETTLE_MS)

      const [step] = await database
        .insert(benchmark__scaling_step_)
        .values({ run_id_: runId, machine_count_: count })
        .returning({ id: benchmark__scaling_step_.id })

      const [batch] = await database
        .insert(benchmark__batch_)
        .values({
          problem_id_: run.problemId,
          language_: run.language,
          requested_count_: run.perStep,
          correct_percent_: 100,
          status_: 'running'
        })
        .returning({ id: benchmark__batch_.id })

      await database
        .update(benchmark__scaling_step_)
        .set({ batch_id_: batch.id })
        .where(eq(benchmark__scaling_step_.id, step.id))

      await runBenchmarkBatch(batch.id, database)
      await waitForStep(database, runId, batch.id)

      await database
        .update(benchmark__scaling_step_)
        .set({ ended_at_: sql`now()` })
        .where(eq(benchmark__scaling_step_.id, step.id))
    }

    await database
      .update(benchmark__scaling_run_)
      .set({ status_: 'completed', ended_at_: sql`now()` })
      .where(
        and(eq(benchmark__scaling_run_.id, runId), eq(benchmark__scaling_run_.status_, 'running'))
      )
  } finally {
    await restoreMachines(database, machineIds, wereEnabled)
    await closeStrayBatches(database, runId)
  }
}

/** Puts the fleet back exactly as the run found it. */
async function restoreMachines(
  database: Database,
  machineIds: string[],
  wereEnabled: string[]
): Promise<void> {
  if (wereEnabled.length > 0) {
    await database
      .update(machine__machine_)
      .set({ enabled_: true })
      .where(inArray(machine__machine_.id, wereEnabled))
      .catch(() => undefined)
  }

  const wereDisabled = machineIds.filter(id => !wereEnabled.includes(id))

  if (wereDisabled.length > 0) {
    await database
      .update(machine__machine_)
      .set({ enabled_: false })
      .where(inArray(machine__machine_.id, wereDisabled))
      .catch(() => undefined)
  }
}

/**
 * A run that was stopped mid-step leaves its batch running, and a running batch
 * blocks the panel's own button. Close them.
 */
async function closeStrayBatches(database: Database, runId: string): Promise<void> {
  const steps = await database
    .select({ batchId: benchmark__scaling_step_.batch_id_ })
    .from(benchmark__scaling_step_)
    .where(eq(benchmark__scaling_step_.run_id_, runId))

  const batchIds = steps
    .map(step => step.batchId)
    .filter((batchId): batchId is string => batchId !== null)

  if (batchIds.length === 0) return

  await database
    .update(benchmark__batch_)
    .set({ status_: 'completed', ended_at_: sql`now()` })
    .where(and(inArray(benchmark__batch_.id, batchIds), eq(benchmark__batch_.status_, 'running')))
    .catch(() => undefined)
}

/** The run this process is driving, so a test can wait for it. */
let activeRun: Promise<void> | null = null

/** Starts a run in the background so the panel's button answers at once. */
export function launchScalingRun(runId: string, database: Database = db): void {
  activeRun = runScalingRun(runId, database)
    .catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)

      console.error(`[benchmark] Scaling run ${runId} stopped: ${message}`)

      await database
        .update(benchmark__scaling_run_)
        .set({ status_: 'failed', ended_at_: sql`now()`, last_error_: message })
        .where(eq(benchmark__scaling_run_.id, runId))
        .catch(() => undefined)
    })
    .finally(() => {
      activeRun = null
    })
}

/** Waits for the run this process is driving, if any. Used by the tests. */
export async function waitForScalingRun(): Promise<void> {
  while (activeRun !== null) {
    await activeRun
  }
}
