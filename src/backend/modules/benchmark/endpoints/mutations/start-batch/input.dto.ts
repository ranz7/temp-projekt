import { BENCHMARK_BATCH_MAX_SUBMISSIONS } from '@backend/modules/benchmark/schema'
import { z } from 'zod'

export const StartBatchInputDTOZ = z.strictObject({
  problemSlug: z.string().min(1, 'Choose a problem.').max(128),
  count: z
    .number()
    .int('Choose a whole number of submissions.')
    .min(1, 'A batch sends at least one submission.')
    .max(
      BENCHMARK_BATCH_MAX_SUBMISSIONS,
      `A batch sends at most ${BENCHMARK_BATCH_MAX_SUBMISSIONS} submissions.`
    )
})

export type StartBatchInputDTO = z.infer<typeof StartBatchInputDTOZ>
