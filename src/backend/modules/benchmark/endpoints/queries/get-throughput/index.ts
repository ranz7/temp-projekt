import { THROUGHPUT_BUCKET_SECONDS } from '@backend/modules/benchmark/internal-functions/settings'
import { machine__machine_ } from '@backend/modules/machine/schema'
import {
  PENDING_SUBMISSION_STATUSES,
  SUBMISSION_STATUSES,
  submission__submission_
} from '@backend/modules/submission/schema'
import { publicProcedure } from '@backend/trpc'
import { and, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm'
import { GetThroughputInputDTOZ } from './input.dto'
import { GetThroughputOutputDTOZ, type ThroughputBucketDTO } from './output.dto'

const MILLISECONDS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60

/** Every status a submission can no longer move away from. */
const FINAL_SUBMISSION_STATUSES = SUBMISSION_STATUSES.filter(
  status => !PENDING_SUBMISSION_STATUSES.some(pending => pending === status)
)

/** The instant the bucket holding `at` begins. */
function bucketStart(at: Date): Date {
  const seconds = Math.floor(at.getTime() / MILLISECONDS_PER_SECOND)

  return new Date(
    Math.floor(seconds / THROUGHPUT_BUCKET_SECONDS) *
      THROUGHPUT_BUCKET_SECONDS *
      MILLISECONDS_PER_SECOND
  )
}

/**
 * How fast submissions are being finished, and how many machines were doing the
 * finishing. Both are measured: every number here counts submissions that actually
 * reached a final status, and the machines that reported them.
 */
export const getThroughputProcedure = publicProcedure
  .meta({ operation: 'benchmark.getThroughput', procedureKind: 'query' })
  .input(GetThroughputInputDTOZ)
  .output(GetThroughputOutputDTOZ)
  .query(async ({ ctx, input }) => {
    const bucketCount = (input.windowMinutes * SECONDS_PER_MINUTE) / THROUGHPUT_BUCKET_SECONDS
    const latestBucket = bucketStart(new Date())
    const windowStart = new Date(
      latestBucket.getTime() -
        (bucketCount - 1) * THROUGHPUT_BUCKET_SECONDS * MILLISECONDS_PER_SECOND
    )
    const lastMinuteStart = new Date(Date.now() - SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND)
    const finished = and(
      isNotNull(submission__submission_.judged_at_),
      inArray(submission__submission_.status_, FINAL_SUBMISSION_STATUSES)
    )
    // `judged_at_` is an instant, so flooring its epoch puts every finish in the same
    // bucket the panel draws, whatever the reader's timezone.
    const bucketEpoch = sql<number>`(floor(extract(epoch from ${submission__submission_.judged_at_}) / ${sql.raw(String(THROUGHPUT_BUCKET_SECONDS))}) * ${sql.raw(String(THROUGHPUT_BUCKET_SECONDS))})::double precision`

    const [rows, lastMinute, machineTotals, working] = await Promise.all([
      ctx.db
        .select({
          bucket: bucketEpoch,
          finished: sql<number>`count(*)::int`,
          machines: sql<number>`count(distinct ${submission__submission_.machine_id_})::int`
        })
        .from(submission__submission_)
        .where(and(finished, gte(submission__submission_.judged_at_, windowStart)))
        .groupBy(bucketEpoch),
      ctx.db
        .select({ finished: sql<number>`count(*)::int` })
        .from(submission__submission_)
        .where(and(finished, gte(submission__submission_.judged_at_, lastMinuteStart))),
      ctx.db
        .select({
          total: sql<number>`count(*)::int`,
          online: sql<number>`(count(*) filter (where ${machine__machine_.enabled_} and ${machine__machine_.reachable_}))::int`
        })
        .from(machine__machine_),
      ctx.db
        .select({
          machines: sql<number>`count(distinct ${submission__submission_.machine_id_})::int`
        })
        .from(submission__submission_)
        .where(eq(submission__submission_.status_, 'running'))
    ])

    const measured = new Map(rows.map(row => [Number(row.bucket), row]))
    const buckets: ThroughputBucketDTO[] = []

    for (let index = 0; index < bucketCount; index += 1) {
      const startedAt = new Date(
        windowStart.getTime() + index * THROUGHPUT_BUCKET_SECONDS * MILLISECONDS_PER_SECOND
      )
      const row = measured.get(startedAt.getTime() / MILLISECONDS_PER_SECOND)

      buckets.push({
        startedAt,
        finished: row?.finished ?? 0,
        finishedPerMinute: ((row?.finished ?? 0) * SECONDS_PER_MINUTE) / THROUGHPUT_BUCKET_SECONDS,
        machines: row?.machines ?? 0
      })
    }

    const finishedLastMinute = lastMinute[0]?.finished ?? 0

    return {
      bucketSeconds: THROUGHPUT_BUCKET_SECONDS,
      windowMinutes: input.windowMinutes,
      buckets,
      current: {
        finishedLastMinute,
        finishedPerMinute: finishedLastMinute,
        machinesWorking: working[0]?.machines ?? 0,
        machinesOnline: machineTotals[0]?.online ?? 0,
        machinesTotal: machineTotals[0]?.total ?? 0
      }
    }
  })
