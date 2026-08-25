import { z } from 'zod'

export const GlobalRankingRowDTOZ = z.object({
  /** Position in this list, starting at 1 and dense. */
  rank: z.number().int().positive(),
  userId: z.uuid(),
  username: z.string(),
  /** Distinct problems this person has an accepted submission for. */
  solvedCount: z.number().int().positive()
})

export const GetGlobalRankingOutputDTOZ = z.array(GlobalRankingRowDTOZ)

export type GlobalRankingRowDTO = z.infer<typeof GlobalRankingRowDTOZ>
export type GetGlobalRankingOutputDTO = z.infer<typeof GetGlobalRankingOutputDTOZ>
