import { benchmark__scaling_run_ } from '@backend/modules/benchmark/schema'
import { publicProcedure } from '@backend/trpc'
import { eq, sql } from 'drizzle-orm'
import { StopScalingRunInputDTOZ } from './input.dto'
import { StopScalingRunOutputDTOZ } from './output.dto'

/**
 * Stops the run where it is. The step in flight keeps whatever solutions it already
 * sent, and the runner puts every machine back to work on its way out.
 */
export const stopScalingRunProcedure = publicProcedure
  .meta({ operation: 'benchmark.stopScalingRun', procedureKind: 'mutation' })
  .input(StopScalingRunInputDTOZ)
  .output(StopScalingRunOutputDTOZ)
  .mutation(async ({ ctx }) => {
    const stopped = await ctx.db
      .update(benchmark__scaling_run_)
      .set({ status_: 'stopped', ended_at_: sql`now()` })
      .where(eq(benchmark__scaling_run_.status_, 'running'))
      .returning({ id: benchmark__scaling_run_.id })

    return { stopped: stopped.length > 0 }
  })
