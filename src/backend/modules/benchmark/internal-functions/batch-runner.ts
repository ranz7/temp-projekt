import { type Database, db } from '@backend/database/db'
import { benchmark__batch_, benchmark__batch_submission_ } from '@backend/modules/benchmark/schema'
import { submission__submission_ } from '@backend/modules/submission/schema'
import { type SubmissionLanguage, task__problem_ } from '@backend/modules/task/schema'
import { eq, sql } from 'drizzle-orm'
import { resolveBenchmarkAuthorId } from './benchmark-author'
import { getBenchmarkSubmissionIntervalMs } from './settings'
import { findBenchmarkSolutionSet, readBenchmarkSolutionPair } from './solutions'

/** Seven in ten of a batch are the correct solution, the rest the wrong one. */
export const BENCHMARK_CORRECT_SHARE = 0.7

/**
 * Which solution each submission of a batch carries: as close to seven in ten correct
 * as the count allows, then shuffled, so the verdicts land mixed rather than in two
 * blocks and a stopped batch still holds roughly the same mixture.
 */
export function buildBatchDeck(count: number): boolean[] {
  const correctCount = Math.round(count * BENCHMARK_CORRECT_SHARE)
  const deck = Array.from({ length: count }, (_, index) => index < correctCount)

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(Math.random() * (index + 1))
    const held = deck[index]

    deck[index] = deck[swapWith]
    deck[swapWith] = held
  }

  return deck
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

/**
 * Creates a batch's submissions one after another until it reaches the requested
 * count, or until someone stops it.
 *
 * Each submission is an ordinary submission by the `benchmark` account, so the
 * dispatcher picks it up like anyone else's and it shows on the homepage, in the
 * ranking and in solve counts.
 */
export async function runBenchmarkBatch(batchId: string, database: Database = db): Promise<void> {
  const [batch] = await database
    .select({
      status: benchmark__batch_.status_,
      problemId: benchmark__batch_.problem_id_,
      problemSlug: task__problem_.slug_,
      language: benchmark__batch_.language_,
      requestedCount: benchmark__batch_.requested_count_
    })
    .from(benchmark__batch_)
    .innerJoin(task__problem_, eq(task__problem_.id, benchmark__batch_.problem_id_))
    .where(eq(benchmark__batch_.id, batchId))
    .limit(1)

  if (batch?.status !== 'running') return

  const solutionSet = findBenchmarkSolutionSet(batch.problemSlug)

  if (solutionSet === null) {
    throw new Error(`No reference solutions ship for ${batch.problemSlug}.`)
  }

  const sources = await readBenchmarkSolutionPair(solutionSet)
  const authorId = await resolveBenchmarkAuthorId(database)
  const deck = buildBatchDeck(batch.requestedCount)
  const intervalMs = getBenchmarkSubmissionIntervalMs()

  for (const [index, isCorrect] of deck.entries()) {
    if (index > 0 && intervalMs > 0) {
      await delay(intervalMs)
    }

    const created = await createBatchSubmission({
      database,
      batchId,
      problemId: batch.problemId,
      authorId,
      language: batch.language,
      sourceCode: isCorrect ? sources.correct : sources.wrong,
      isCorrect
    })

    // Stopped while we were creating: whatever exists stays and gets judged.
    if (!created) return
  }

  await database
    .update(benchmark__batch_)
    .set({ status_: 'completed', ended_at_: sql`now()` })
    .where(eq(benchmark__batch_.id, batchId))
}

type CreateBatchSubmissionInput = {
  database: Database
  batchId: string
  problemId: string
  authorId: string
  language: SubmissionLanguage
  sourceCode: string
  isCorrect: boolean
}

/**
 * One submission of a batch. The batch's own row is locked first, so a stop that
 * arrives mid-flight is seen before anything new is written. Returns false when the
 * batch is no longer running.
 */
async function createBatchSubmission(input: CreateBatchSubmissionInput): Promise<boolean> {
  return input.database.transaction(async transaction => {
    const [batch] = await transaction
      .select({ status: benchmark__batch_.status_ })
      .from(benchmark__batch_)
      .where(eq(benchmark__batch_.id, input.batchId))
      .limit(1)
      .for('update')

    if (batch?.status !== 'running') return false

    const [submission] = await transaction
      .insert(submission__submission_)
      .values({
        problem_id_: input.problemId,
        user_id_: input.authorId,
        language_: input.language,
        source_code_: input.sourceCode,
        status_: 'queued'
      })
      .returning({ id: submission__submission_.id })

    await transaction.insert(benchmark__batch_submission_).values({
      batch_id_: input.batchId,
      submission_id_: submission.id,
      expects_accepted_: input.isCorrect
    })

    await transaction
      .update(benchmark__batch_)
      .set({ created_count_: sql`${benchmark__batch_.created_count_} + 1` })
      .where(eq(benchmark__batch_.id, input.batchId))

    return true
  })
}

/** The run this process started, so a test can wait for it and a restart can see none. */
let activeRun: Promise<void> | null = null

/**
 * Starts a batch running in the background and hands the caller back at once, so the
 * panel's button answers immediately.
 */
export function launchBenchmarkBatch(batchId: string, database: Database = db): void {
  activeRun = runBenchmarkBatch(batchId, database)
    .catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)

      console.error(`[benchmark] Batch ${batchId} stopped: ${message}`)

      await database
        .update(benchmark__batch_)
        .set({ status_: 'failed', ended_at_: sql`now()`, last_error_: message })
        .where(eq(benchmark__batch_.id, batchId))
        .catch(() => undefined)
    })
    .finally(() => {
      activeRun = null
    })
}

/** Waits for the batch this process is running, if any. Used by the tests. */
export async function waitForBenchmarkBatch(): Promise<void> {
  while (activeRun !== null) {
    await activeRun
  }
}
