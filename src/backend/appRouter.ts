import { createTRPCRouter } from '@backend/trpc'
import { accountRouter } from './modules/account/router'
import { rankingRouter } from './modules/ranking/router'
import { submissionRouter } from './modules/submission/router'
import { taskRouter } from './modules/task/router'

export const appRouter = createTRPCRouter({
  account: accountRouter,
  task: taskRouter,
  submission: submissionRouter,
  ranking: rankingRouter
})

export type AppRouter = typeof appRouter
