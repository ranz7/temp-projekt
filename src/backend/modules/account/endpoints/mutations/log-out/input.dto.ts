import { z } from 'zod'

export const LogOutInputDTOZ = z.object({}).optional()

export type LogOutInputDTO = z.infer<typeof LogOutInputDTOZ>
