import {
  RANKING_LIMIT_DEFAULT,
  RankingLimitZ
} from '@backend/modules/ranking/internal-functions/limit'
import { z } from 'zod'

export const GetGlobalRankingInputDTOZ = z
  .object({
    /** How many people to return, best first. */
    limit: RankingLimitZ
  })
  .default({ limit: RANKING_LIMIT_DEFAULT })

export type GetGlobalRankingInputDTO = z.infer<typeof GetGlobalRankingInputDTOZ>
