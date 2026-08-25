import { z } from 'zod'

export const LogInOutputDTOZ = z.object({
  id: z.uuid(),
  username: z.string(),
  createdAt: z.date()
})

export type LogInOutputDTO = z.infer<typeof LogInOutputDTOZ>
