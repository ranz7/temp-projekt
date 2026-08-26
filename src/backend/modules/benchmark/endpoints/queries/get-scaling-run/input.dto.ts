import { z } from 'zod'

export const GetScalingRunInputDTOZ = z.strictObject({}).optional()

export type GetScalingRunInputDTO = z.infer<typeof GetScalingRunInputDTOZ>
