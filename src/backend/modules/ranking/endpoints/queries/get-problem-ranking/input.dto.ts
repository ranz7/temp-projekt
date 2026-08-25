import { RankingLimitZ } from '@backend/modules/ranking/internal-functions/limit'
import { z } from 'zod'

export const GetProblemRankingInputDTOZ = z.object({
  /** How the problem is addressed in a URL, for example `cf-4-A`. */
  slug: z.string().min(1).max(128),
  /** How many people to return, earliest solver first. */
  limit: RankingLimitZ
})

export type GetProblemRankingInputDTO = z.infer<typeof GetProblemRankingInputDTOZ>
