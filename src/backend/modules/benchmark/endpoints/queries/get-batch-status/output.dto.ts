import { BENCHMARK_BATCH_STATUSES } from '@backend/modules/benchmark/schema'
import { SUBMISSION_STATUSES } from '@backend/modules/submission/schema'
import { SUBMISSION_LANGUAGES } from '@backend/modules/task/schema'
import { z } from 'zod'

/** How many of a batch's submissions ended on one verdict. */
export const BatchVerdictCountDTOZ = z.strictObject({
  status: z.enum(SUBMISSION_STATUSES),
  count: z.number().int().nonnegative()
})

export const BatchStatusDTOZ = z.strictObject({
  id: z.uuid(),
  problemSlug: z.string(),
  problemTitle: z.string(),
  language: z.enum(SUBMISSION_LANGUAGES),
  status: z.enum(BENCHMARK_BATCH_STATUSES),
  /** How many submissions were asked for. */
  requestedCount: z.number().int().nonnegative(),
  /** How many have actually been sent so far. */
  createdCount: z.number().int().nonnegative(),
  /** How many of those have reached a final status. */
  finishedCount: z.number().int().nonnegative(),
  /** How many are still queued or being judged. */
  pendingCount: z.number().int().nonnegative(),
  /** One entry per final status the batch produced, in the order statuses are listed. */
  verdicts: z.array(BatchVerdictCountDTOZ),
  startedAt: z.date(),
  endedAt: z.date().nullable(),
  /** Why a batch gave up, when it did. */
  error: z.string().nullable()
})

export const GetBatchStatusOutputDTOZ = z.strictObject({
  /** The running batch, else the most recent one, else null when none was ever sent. */
  batch: BatchStatusDTOZ.nullable()
})

export type BatchVerdictCountDTO = z.infer<typeof BatchVerdictCountDTOZ>
export type BatchStatusDTO = z.infer<typeof BatchStatusDTOZ>
export type GetBatchStatusOutputDTO = z.infer<typeof GetBatchStatusOutputDTOZ>
