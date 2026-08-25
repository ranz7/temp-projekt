import 'server-only'

import { appRouter } from '@backend/appRouter'
import { createCallerFactory, createTRPCContext } from '@backend/trpc'
import { headers } from 'next/headers'

const createCaller = createCallerFactory(appRouter)

/**
 * The newest submissions from everyone, newest first - for the homepage's
 * activity panel. A direct server call, same pattern as `getCurrentUser`:
 * no client cache involved, since the panel has no filters to react to.
 */
export async function getRecentSubmissions(limit: number) {
  const ctx = await createTRPCContext({ headers: new Headers(await headers()) })
  const caller = createCaller(ctx)

  return caller.submission.listSubmissions({ page: 1, pageSize: limit })
}
