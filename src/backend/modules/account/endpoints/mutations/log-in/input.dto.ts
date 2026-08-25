import { USERNAME_MAX_LENGTH } from '@backend/modules/account/schema'
import { z } from 'zod'

/** Letters, digits, `_`, `-` and `.` only. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_.-]+$/

export const UsernameZ = z
  .string()
  .min(1, 'Enter a username.')
  .max(USERNAME_MAX_LENGTH, `A username is at most ${USERNAME_MAX_LENGTH} characters.`)
  .regex(USERNAME_PATTERN, 'A username may hold only letters, digits, "_", "-" and ".".')

export const LogInInputDTOZ = z.object({
  username: UsernameZ
})

export type LogInInputDTO = z.infer<typeof LogInInputDTOZ>
