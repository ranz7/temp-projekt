import { benchmark__batch_ } from '@backend/modules/benchmark/schema'
import { publicProcedure } from '@backend/trpc'
import { eq, sql } from 'drizzle-orm'
import { StopBatchInputDTOZ } from './input.dto'
import { StopBatchOutputDTOZ } from './output.dto'

/**
 * Stops the running batch. No further submission is created; the ones already sent
 * stay in the queue and are judged like anyone else's.
 *
 * It stops whatever the database says is running, not only what this process started,
 * so a batch left behind by a restarted server can always be cleared from the panel.
 */
export const stopBatchProcedure = publicProcedure
  .meta({ operation: 'benchmark.stopBatch', procedureKind: 'mutation' })
  .input(StopBatchInputDTOZ)
  .output(StopBatchOutputDTOZ)
  .mutation(async ({ ctx }) => {
    const stopped = await ctx.db
      .update(benchmark__batch_)
      .set({ status_: 'stopped', ended_at_: sql`now()` })
      .where(eq(benchmark__batch_.status_, 'running'))
      .returning({
        id: benchmark__batch_.id,
        createdCount: benchmark__batch_.created_count_
      })

    if (stopped.length === 0) {
      return { stopped: false, id: null, createdCount: 0 }
    }

    return { stopped: true, id: stopped[0].id, createdCount: stopped[0].createdCount }
  })
