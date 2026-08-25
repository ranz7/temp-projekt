import { z } from 'zod'

export const GetBatchStatusInputDTOZ = z.object({}).optional()

export type GetBatchStatusInputDTO = z.infer<typeof GetBatchStatusInputDTOZ>
