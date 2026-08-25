'use client'

import type { AppRouter } from '@backend/appRouter'
import {
  type DehydratedState,
  HydrationBoundary,
  type QueryClient,
  QueryClientProvider
} from '@tanstack/react-query'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { useState } from 'react'
import superjson from 'superjson'
import { TRPCProvider } from './config'
import { makeQueryClient } from './query-client'

const TRPC_ENDPOINT = '/api/trpc'

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient()
  }

  browserQueryClient ??= makeQueryClient()
  return browserQueryClient
}

export function TrpcProvider({
  children,
  dehydratedState
}: {
  children: React.ReactNode
  dehydratedState?: DehydratedState
}) {
  const queryClient = getQueryClient()

  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: TRPC_ENDPOINT,
          transformer: superjson
        })
      ]
    })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={dehydratedState} queryClient={queryClient}>
        <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
          {children}
        </TRPCProvider>
      </HydrationBoundary>
    </QueryClientProvider>
  )
}
