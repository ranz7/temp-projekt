import { createTRPCRouter } from '@backend/trpc'
import { noteRouter } from './modules/note/router'

export const appRouter = createTRPCRouter({
  note: noteRouter
})

export type AppRouter = typeof appRouter
