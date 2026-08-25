import { createTRPCRouter } from '@backend/trpc'
import { getProblemProcedure } from './endpoints/queries/get-problem'
import { listProblemsProcedure } from './endpoints/queries/list-problems'

export const taskRouter = createTRPCRouter({
  listProblems: listProblemsProcedure,
  getProblem: getProblemProcedure
})
