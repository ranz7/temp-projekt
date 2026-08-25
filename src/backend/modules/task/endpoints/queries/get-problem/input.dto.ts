import { z } from 'zod'

export const GetProblemInputDTOZ = z.object({
  /** A problem is addressed by its slug, as in `/problems/cf-4-A`. */
  slug: z.string().trim().min(1).max(128)
})

export type GetProblemInputDTO = z.infer<typeof GetProblemInputDTOZ>
