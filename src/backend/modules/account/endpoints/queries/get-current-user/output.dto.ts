import { z } from 'zod'

export const CurrentUserDTOZ = z.object({
  id: z.uuid(),
  username: z.string(),
  createdAt: z.date()
})

/** Null for a visitor who is not signed in. */
export const GetCurrentUserOutputDTOZ = CurrentUserDTOZ.nullable()

export type CurrentUserDTO = z.infer<typeof CurrentUserDTOZ>
export type GetCurrentUserOutputDTO = z.infer<typeof GetCurrentUserOutputDTOZ>
