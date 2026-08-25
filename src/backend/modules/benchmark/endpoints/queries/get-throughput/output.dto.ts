import { z } from 'zod'

/** One point on the throughput line. */
export const ThroughputBucketDTOZ = z.strictObject({
  startedAt: z.date(),
  /** Submissions that reached a final status inside this bucket. */
  finished: z.number().int().nonnegative(),
  /** The same count expressed as a rate, so buckets of any width read alike. */
  finishedPerMinute: z.number().nonnegative(),
  /** How many machines finished something in this bucket. */
  machines: z.number().int().nonnegative()
})

export const GetThroughputOutputDTOZ = z.strictObject({
  /** How wide one bucket is, in seconds. */
  bucketSeconds: z.number().int().positive(),
  windowMinutes: z.number().int().positive(),
  /** Oldest bucket first, every bucket present even when nothing finished in it. */
  buckets: z.array(ThroughputBucketDTOZ),
  current: z.strictObject({
    /** Submissions finished in the last sixty seconds. */
    finishedLastMinute: z.number().int().nonnegative(),
    finishedPerMinute: z.number().nonnegative(),
    /** Machines judging something right now. */
    machinesWorking: z.number().int().nonnegative(),
    /** Machines enabled and answering. */
    machinesOnline: z.number().int().nonnegative(),
    machinesTotal: z.number().int().nonnegative()
  })
})

export type ThroughputBucketDTO = z.infer<typeof ThroughputBucketDTOZ>
export type GetThroughputOutputDTO = z.infer<typeof GetThroughputOutputDTOZ>
