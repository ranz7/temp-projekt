import { z } from 'zod'

export const GetCurrentUserInputDTOZ = z.object({}).optional()

export type GetCurrentUserInputDTO = z.infer<typeof GetCurrentUserInputDTOZ>
