import 'server-only'

import type { AppRouter } from '@backend/appRouter'
import { appRouter } from '@backend/appRouter'
import { createTRPCContext } from '@backend/trpc'
import type { FetchQueryOptions } from '@tanstack/react-query'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import { headers } from 'next/headers'
import { cache } from 'react'
import { makeRscPrefetchQueryClient } from './query-client'

export const getQueryClient = cache(makeRscPrefetchQueryClient)

async function createRscContext() {
  return createTRPCContext({ headers: new Headers(await headers()) })
}

export const trpc = createTRPCOptionsProxy<AppRouter>({
  ctx: () => createRscContext(),
  router: appRouter,
  queryClient: getQueryClient
})

export function prefetch<TQueryFnData, TError, TData, TQueryKey extends readonly unknown[]>(
  queryOptions: FetchQueryOptions<TQueryFnData, TError, TData, TQueryKey>
): void {
  void getQueryClient().prefetchQuery(queryOptions)
}

export async function prefetchAwaited<
  TQueryFnData,
  TError,
  TData,
  TQueryKey extends readonly unknown[]
>(queryOptions: FetchQueryOptions<TQueryFnData, TError, TData, TQueryKey>): Promise<void> {
  await getQueryClient().prefetchQuery(queryOptions)
}
