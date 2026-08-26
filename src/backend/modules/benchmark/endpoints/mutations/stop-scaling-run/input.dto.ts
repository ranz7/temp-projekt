import { z } from 'zod'

export const StopScalingRunInputDTOZ = z.strictObject({})

export type StopScalingRunInputDTO = z.infer<typeof StopScalingRunInputDTOZ>
