import { initTRPC } from '@trpc/server'
import superjson from 'superjson'
import type { ProcedureMeta, TRPCContext } from './context'

export const t = initTRPC.context<TRPCContext>().meta<ProcedureMeta>().create({
  transformer: superjson
})

export const createCallerFactory = t.createCallerFactory
export const createTRPCRouter = t.router
