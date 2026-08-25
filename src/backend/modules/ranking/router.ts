import { createTRPCRouter } from '@backend/trpc'
import { getGlobalRankingProcedure } from './endpoints/queries/get-global-ranking'
import { getProblemRankingProcedure } from './endpoints/queries/get-problem-ranking'

export const rankingRouter = createTRPCRouter({
  getGlobalRanking: getGlobalRankingProcedure,
  getProblemRanking: getProblemRankingProcedure
})
