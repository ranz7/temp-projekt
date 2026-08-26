import {
  benchmark__batch_submission_,
  benchmark__scaling_run_,
  benchmark__scaling_step_
} from '@backend/modules/benchmark/schema'
import {
  PENDING_SUBMISSION_STATUSES,
  submission__submission_
} from '@backend/modules/submission/schema'
import { task__problem_ } from '@backend/modules/task/schema'
import { publicProcedure } from '@backend/trpc'
import { asc, desc, eq, sql } from 'drizzle-orm'
import { GetScalingRunInputDTOZ } from './input.dto'
import { GetScalingRunOutputDTOZ, type ScalingStepDTO } from './output.dto'

const MILLISECONDS_PER_MINUTE = 60_000

/**
 * The scaling run the panel is watching: the one going now if there is one, otherwise
 * the last one measured. Every number is read from the submissions themselves, so the
 * curve is the judge's own timestamps rather than a stopwatch held beside it.
 */
export const getScalingRunProcedure = publicProcedure
  .meta({ operation: 'benchmark.getScalingRun', procedureKind: 'query' })
  .input(GetScalingRunInputDTOZ)
  .output(GetScalingRunOutputDTOZ)
  .query(async ({ ctx }) => {
    const [run] = await ctx.db
      .select({
        id: benchmark__scaling_run_.id,
        problemSlug: task__problem_.slug_,
        problemTitle: task__problem_.title_,
        language: benchmark__scaling_run_.language_,
        status: benchmark__scaling_run_.status_,
        submissionsPerStep: benchmark__scaling_run_.submissions_per_step_,
        maxMachines: benchmark__scaling_run_.max_machines_,
        startedAt: benchmark__scaling_run_.started_at_,
        endedAt: benchmark__scaling_run_.ended_at_,
        error: benchmark__scaling_run_.last_error_
      })
      .from(benchmark__scaling_run_)
      .innerJoin(task__problem_, eq(task__problem_.id, benchmark__scaling_run_.problem_id_))
      // The running one first, then the newest. At most one row is ever running.
      .orderBy(
        desc(sql`case when ${benchmark__scaling_run_.status_} = 'running' then 1 else 0 end`),
        desc(benchmark__scaling_run_.started_at_)
      )
      .limit(1)

    if (!run) return { run: null }

    const pendingList = sql.raw(PENDING_SUBMISSION_STATUSES.map(status => `'${status}'`).join(', '))

    const rows = await ctx.db
      .select({
        machineCount: benchmark__scaling_step_.machine_count_,
        endedAt: benchmark__scaling_step_.ended_at_,
        busySamples: benchmark__scaling_step_.busy_samples_,
        busyTotal: benchmark__scaling_step_.busy_total_,
        capacityTotal: benchmark__scaling_step_.capacity_total_,
        sent: sql<number>`count(${submission__submission_.id})::int`,
        finished: sql<number>`count(*) filter (
          where ${submission__submission_.status_} is not null
            and ${submission__submission_.status_} not in (${pendingList})
        )::int`,
        accepted: sql<number>`count(*) filter (
          where ${submission__submission_.status_} = 'accepted'
        )::int`,
        firstSentAt: sql<Date | null>`min(${submission__submission_.created_at_})`,
        lastJudgedAt: sql<Date | null>`max(${submission__submission_.judged_at_})`
      })
      .from(benchmark__scaling_step_)
      .leftJoin(
        benchmark__batch_submission_,
        eq(benchmark__batch_submission_.batch_id_, benchmark__scaling_step_.batch_id_)
      )
      .leftJoin(
        submission__submission_,
        eq(submission__submission_.id, benchmark__batch_submission_.submission_id_)
      )
      .where(eq(benchmark__scaling_step_.run_id_, run.id))
      .groupBy(
        benchmark__scaling_step_.id,
        benchmark__scaling_step_.machine_count_,
        benchmark__scaling_step_.ended_at_,
        benchmark__scaling_step_.busy_samples_,
        benchmark__scaling_step_.busy_total_,
        benchmark__scaling_step_.capacity_total_
      )
      .orderBy(asc(benchmark__scaling_step_.machine_count_))

    const steps: ScalingStepDTO[] = rows.map(row => {
      const isFinished = row.endedAt !== null && row.finished === row.sent && row.sent > 0
      const first = row.firstSentAt === null ? null : new Date(row.firstSentAt).getTime()
      const last = row.lastJudgedAt === null ? null : new Date(row.lastJudgedAt).getTime()
      // A step so fast that both timestamps land in the same millisecond would divide
      // by zero, so the shortest measurable step is one millisecond long.
      const wallMs =
        isFinished && first !== null && last !== null ? Math.max(last - first, 1) : null

      const hasSamples = row.busySamples > 0

      return {
        machineCount: row.machineCount,
        requested: run.submissionsPerStep,
        sent: row.sent,
        finished: row.finished,
        accepted: row.accepted,
        wallMs,
        perMinute: wallMs === null ? null : (row.finished * MILLISECONDS_PER_MINUTE) / wallMs,
        slotsBusy: hasSamples ? row.busyTotal / row.busySamples : null,
        slotsTotal: hasSamples ? Math.round(row.capacityTotal / row.busySamples) : null,
        isFinished
      }
    })

    const currentMachineCount =
      run.status === 'running' ? (steps.find(step => !step.isFinished)?.machineCount ?? null) : null

    return { run: { ...run, steps, currentMachineCount } }
  })
