import { z } from 'zod'

export const GetSubmissionInputDTOZ = z.object({
  id: z.uuid()
})

export type GetSubmissionInputDTO = z.infer<typeof GetSubmissionInputDTOZ>
