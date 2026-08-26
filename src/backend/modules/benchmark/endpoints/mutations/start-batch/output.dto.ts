import { SUBMISSION_LANGUAGES } from '@backend/modules/task/schema'
import { z } from 'zod'

export const StartBatchOutputDTOZ = z.strictObject({
  id: z.uuid(),
  problemSlug: z.string(),
  /** The language this problem's batch is sent in. */
  language: z.enum(SUBMISSION_LANGUAGES),
  requestedCount: z.number().int().positive(),
  startedAt: z.date()
})

export type StartBatchOutputDTO = z.infer<typeof StartBatchOutputDTOZ>
