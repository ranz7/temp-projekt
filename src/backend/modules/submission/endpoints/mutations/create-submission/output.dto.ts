import { SUBMISSION_STATUSES } from '@backend/modules/submission/schema'
import { z } from 'zod'

export const CreateSubmissionOutputDTOZ = z.strictObject({
  id: z.uuid(),
  status: z.enum(SUBMISSION_STATUSES)
})

export type CreateSubmissionOutputDTO = z.infer<typeof CreateSubmissionOutputDTOZ>
