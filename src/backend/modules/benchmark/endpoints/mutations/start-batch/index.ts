import { launchBenchmarkBatch } from '@backend/modules/benchmark/internal-functions/batch-runner'
import { findBenchmarkSolutionSet } from '@backend/modules/benchmark/internal-functions/solutions'
import { benchmark__batch_ } from '@backend/modules/benchmark/schema'
import { task__problem_ } from '@backend/modules/task/schema'
import { publicProcedure } from '@backend/trpc'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { StartBatchInputDTOZ } from './input.dto'
import { StartBatchOutputDTOZ } from './output.dto'

/** Postgres refuses a second running batch through the partial unique index. */
const SINGLE_RUNNING_INDEX = 'benchmark__batch__single_running__unique_idx_'

function isSecondRunningBatch(error: unknown): boolean {
  return error instanceof Error && error.message.includes(SINGLE_RUNNING_INDEX)
}

/**
 * Sends a batch of shipped solutions, mixing correct and deliberately wrong ones. Open
 * to anyone who knows the address: this deployment's panel has no sign-in, on purpose.
 */
export const startBatchProcedure = publicProcedure
  .meta({ operation: 'benchmark.startBatch', procedureKind: 'mutation' })
  .input(StartBatchInputDTOZ)
  .output(StartBatchOutputDTOZ)
  .mutation(async ({ ctx, input }) => {
    const [problem] = await ctx.db
      .select({
        id: task__problem_.id,
        slug: task__problem_.slug_,
        languages: task__problem_.languages_
      })
      .from(task__problem_)
      .where(eq(task__problem_.slug_, input.problemSlug))
      .limit(1)

    if (!problem) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'We could not find that problem.' })
    }

    const solutionSet = findBenchmarkSolutionSet(problem.slug)

    if (solutionSet === null || !problem.languages.includes(solutionSet.language)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No batch solutions ship for this problem.'
      })
    }

    const running = await ctx.db
      .select({ id: benchmark__batch_.id })
      .from(benchmark__batch_)
      .where(eq(benchmark__batch_.status_, 'running'))
      .limit(1)

    if (running.length > 0) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'A batch is already running. Stop it before starting another.'
      })
    }

    const batch = await ctx.db
      .insert(benchmark__batch_)
      .values({
        problem_id_: problem.id,
        language_: solutionSet.language,
        requested_count_: input.count,
        status_: 'running'
      })
      .returning({
        id: benchmark__batch_.id,
        startedAt: benchmark__batch_.started_at_
      })
      .catch((error: unknown) => {
        // Two presses at the same instant: the index, not the read above, decides.
        if (isSecondRunningBatch(error)) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A batch is already running. Stop it before starting another.'
          })
        }

        throw error
      })

    // The submissions are created steadily in the background, so the button answers now.
    launchBenchmarkBatch(batch[0].id, ctx.db)

    return {
      id: batch[0].id,
      problemSlug: problem.slug,
      language: solutionSet.language,
      requestedCount: input.count,
      startedAt: batch[0].startedAt
    }
  })
