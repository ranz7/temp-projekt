import { benchmark__batch_, benchmark__batch_submission_ } from '@backend/modules/benchmark/schema'
import {
  PENDING_SUBMISSION_STATUSES,
  SUBMISSION_STATUSES,
  type SubmissionStatus,
  submission__submission_
} from '@backend/modules/submission/schema'
import { task__problem_ } from '@backend/modules/task/schema'
import { publicProcedure } from '@backend/trpc'
import { desc, eq, sql } from 'drizzle-orm'
import { GetBatchStatusInputDTOZ } from './input.dto'
import { type BatchVerdictCountDTO, GetBatchStatusOutputDTOZ } from './output.dto'

const PENDING: readonly string[] = PENDING_SUBMISSION_STATUSES

function isPending(status: SubmissionStatus): boolean {
  return PENDING.includes(status)
}

/**
 * The batch the panel is watching: the running one if there is one, otherwise the last
 * one sent. Its counts are read from the submissions themselves, so they follow the
 * queue rather than a tally kept alongside it.
 */
export const getBatchStatusProcedure = publicProcedure
  .meta({ operation: 'benchmark.getBatchStatus', procedureKind: 'query' })
  .input(GetBatchStatusInputDTOZ)
  .output(GetBatchStatusOutputDTOZ)
  .query(async ({ ctx }) => {
    const [batch] = await ctx.db
      .select({
        id: benchmark__batch_.id,
        problemSlug: task__problem_.slug_,
        problemTitle: task__problem_.title_,
        language: benchmark__batch_.language_,
        status: benchmark__batch_.status_,
        requestedCount: benchmark__batch_.requested_count_,
        createdCount: benchmark__batch_.created_count_,
        startedAt: benchmark__batch_.started_at_,
        endedAt: benchmark__batch_.ended_at_,
        error: benchmark__batch_.last_error_
      })
      .from(benchmark__batch_)
      .innerJoin(task__problem_, eq(task__problem_.id, benchmark__batch_.problem_id_))
      // The running batch first, then the newest. At most one row is ever running.
      .orderBy(
        desc(sql`case when ${benchmark__batch_.status_} = 'running' then 1 else 0 end`),
        desc(benchmark__batch_.started_at_)
      )
      .limit(1)

    if (!batch) return { batch: null }

    const counted = await ctx.db
      .select({
        status: submission__submission_.status_,
        count: sql<number>`count(*)::int`
      })
      .from(benchmark__batch_submission_)
      .innerJoin(
        submission__submission_,
        eq(submission__submission_.id, benchmark__batch_submission_.submission_id_)
      )
      .where(eq(benchmark__batch_submission_.batch_id_, batch.id))
      .groupBy(submission__submission_.status_)

    const byStatus = new Map(counted.map(row => [row.status, row.count]))
    const verdicts: BatchVerdictCountDTO[] = SUBMISSION_STATUSES.filter(
      status => !isPending(status) && byStatus.has(status)
    ).map(status => ({ status, count: byStatus.get(status) ?? 0 }))
    const finishedCount = verdicts.reduce((total, verdict) => total + verdict.count, 0)
    const pendingCount = counted
      .filter(row => isPending(row.status))
      .reduce((total, row) => total + row.count, 0)

    return { batch: { ...batch, finishedCount, pendingCount, verdicts } }
  })
