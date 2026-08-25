import 'server-only'

import { appRouter } from '@backend/appRouter'
import { createCallerFactory, createTRPCContext } from '@backend/trpc'
import { headers } from 'next/headers'

const createCaller = createCallerFactory(appRouter)

/**
 * The signed-in user for the current request, read straight from the session
 * cookie - no React Query cache involved. Any Server Component can await this
 * directly; it never leaks into a Client Component bundle (`server-only`).
 */
export async function getCurrentUser() {
  const ctx = await createTRPCContext({ headers: new Headers(await headers()) })
  const caller = createCaller(ctx)

  return caller.account.getCurrentUser()
}
