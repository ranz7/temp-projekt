import { TRPCError } from '@trpc/server'
import { t } from './init'

export const publicProcedure = t.procedure

/** Refuses an anonymous visitor and narrows `ctx.userId` to a string. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.userId === null) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Log in to continue.' })
  }

  return next({ ctx: { userId: ctx.userId } })
})
