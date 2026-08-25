import { appRouter } from '@backend/appRouter'
import { createTRPCContext } from '@backend/trpc'
import { isDevelopment } from '@shared/environment'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import type { NextRequest } from 'next/server'

const handler = (req: NextRequest) => {
  const headers = new Headers(req.headers)

  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers }),
    onError: isDevelopment()
      ? ({ path, error }) => {
          console.error(`tRPC failed on ${path ?? '<no-path>'}: ${error.message}`)
        }
      : undefined
  })
}

export { handler as GET, handler as POST }
