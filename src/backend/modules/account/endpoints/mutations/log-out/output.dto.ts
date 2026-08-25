import { z } from 'zod'

export const LogOutOutputDTOZ = z.object({
  loggedOut: z.boolean()
})

export type LogOutOutputDTO = z.infer<typeof LogOutOutputDTOZ>
