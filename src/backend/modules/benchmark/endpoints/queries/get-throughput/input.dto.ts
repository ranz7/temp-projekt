import {
  THROUGHPUT_DEFAULT_WINDOW_MINUTES,
  THROUGHPUT_MAX_WINDOW_MINUTES
} from '@backend/modules/benchmark/internal-functions/settings'
import { z } from 'zod'

export const GetThroughputInputDTOZ = z
  .object({
    /** How far back the line reaches. */
    windowMinutes: z
      .number()
      .int()
      .min(1)
      .max(THROUGHPUT_MAX_WINDOW_MINUTES)
      .default(THROUGHPUT_DEFAULT_WINDOW_MINUTES)
  })
  .default({ windowMinutes: THROUGHPUT_DEFAULT_WINDOW_MINUTES })

export type GetThroughputInputDTO = z.infer<typeof GetThroughputInputDTOZ>
