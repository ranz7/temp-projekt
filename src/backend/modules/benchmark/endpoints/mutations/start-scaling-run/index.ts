import {
  launchScalingRun,
  listRunnableMachines
} from '@backend/modules/benchmark/internal-functions/scaling-runner'
import { findBenchmarkSolutionSet } from '@backend/modules/benchmark/internal-functions/solutions'
import { violatesUniqueIndex } from '@backend/modules/benchmark/internal-functions/unique-violation'
import {
  BENCHMARK_SCALING_MAX_MACHINES,
  benchmark__batch_,
  benchmark__scaling_run_
} from '@backend/modules/benchmark/schema'
import { task__problem_ } from '@backend/modules/task/schema'
import { publicProcedure } from '@backend/trpc'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { StartScalingRunInputDTOZ } from './input.dto'
import { StartScalingRunOutputDTOZ } from './output.dto'

/** Postgres refuses a second running run through the partial unique index. */
const SINGLE_RUNNING_INDEX = 'benchmark__scaling_run__single_running__unique_idx_'

function isSecondRunningRun(error: unknown): boolean {
  return violatesUniqueIndex(error, SINGLE_RUNNING_INDEX)
}

const ALREADY_RUNNING = 'A scaling run is already going. Stop it before starting another.'

/**
 * Measures what another machine buys: the same pile of correct solutions is sent to
 * one machine, then two, and so on up the fleet. Open to anyone who knows the
 * address, like the rest of this panel.
 */
export const startScalingRunProcedure = publicProcedure
  .meta({ operation: 'benchmark.startScalingRun', procedureKind: 'mutation' })
  .input(StartScalingRunInputDTOZ)
  .output(StartScalingRunOutputDTOZ)
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
        message: 'No reference solutions ship for this problem.'
      })
    }

    const answering = await listRunnableMachines(ctx.db)

    if (answering.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No machine is answering, so there is nothing to measure.'
      })
    }

    const runningBatch = await ctx.db
      .select({ id: benchmark__batch_.id })
      .from(benchmark__batch_)
      .where(eq(benchmark__batch_.status_, 'running'))
      .limit(1)

    if (runningBatch.length > 0) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'A batch is running. Let it finish, or stop it, before measuring.'
      })
    }

    const maxMachines = Math.min(
      input.maxMachines ?? answering.length,
      answering.length,
      BENCHMARK_SCALING_MAX_MACHINES
    )

    const inserted = await ctx.db
      .insert(benchmark__scaling_run_)
      .values({
        problem_id_: problem.id,
        language_: solutionSet.language,
        submissions_per_step_: input.submissionsPerStep,
        max_machines_: maxMachines,
        status_: 'running'
      })
      .returning({
        id: benchmark__scaling_run_.id,
        startedAt: benchmark__scaling_run_.started_at_
      })
      .catch((error: unknown) => {
        // Two presses at the same instant: the index, not the read above, decides.
        if (isSecondRunningRun(error)) {
          throw new TRPCError({ code: 'CONFLICT', message: ALREADY_RUNNING })
        }

        throw error
      })

    launchScalingRun(inserted[0].id, ctx.db)

    return {
      id: inserted[0].id,
      problemSlug: problem.slug,
      language: solutionSet.language,
      submissionsPerStep: input.submissionsPerStep,
      maxMachines,
      startedAt: inserted[0].startedAt
    }
  })
