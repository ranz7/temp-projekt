import { SUBMISSION_LANGUAGES } from '@backend/modules/task/schema'
import { z } from 'zod'

export const StartScalingRunOutputDTOZ = z.object({
  id: z.uuid(),
  problemSlug: z.string(),
  language: z.enum(SUBMISSION_LANGUAGES),
  submissionsPerStep: z.number().int(),
  /** How many rungs the run will actually climb, given the machines answering now. */
  maxMachines: z.number().int(),
  startedAt: z.date()
})

export type StartScalingRunOutputDTO = z.infer<typeof StartScalingRunOutputDTOZ>
