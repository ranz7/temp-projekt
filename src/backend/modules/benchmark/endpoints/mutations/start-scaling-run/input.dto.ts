import {
  BENCHMARK_SCALING_MAX_MACHINES,
  BENCHMARK_SCALING_MAX_PER_STEP
} from '@backend/modules/benchmark/schema'
import { z } from 'zod'

export const StartScalingRunInputDTOZ = z.strictObject({
  problemSlug: z.string().min(1, 'Choose a problem.').max(128),
  submissionsPerStep: z
    .number()
    .int('Choose a whole number of solutions.')
    .min(1, 'Each step sends at least one solution.')
    .max(
      BENCHMARK_SCALING_MAX_PER_STEP,
      `Each step sends at most ${BENCHMARK_SCALING_MAX_PER_STEP} solutions.`
    ),
  /** Left out, the run climbs to every machine that is answering. */
  maxMachines: z
    .number()
    .int('Choose a whole number of machines.')
    .min(1, 'A run needs at least one machine.')
    .max(BENCHMARK_SCALING_MAX_MACHINES)
    .optional()
})

export type StartScalingRunInputDTO = z.infer<typeof StartScalingRunInputDTOZ>
