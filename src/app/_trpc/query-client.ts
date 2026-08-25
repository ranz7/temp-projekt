import { defaultShouldDehydrateQuery, type Query, QueryClient } from '@tanstack/react-query'
import superjson from 'superjson'
import { shouldRetryQuery } from './query-retry'

const STALE_TIME = 1000 * 30
const GC_TIME = 1000 * 60 * 5

const dehydrate = {
  serializeData: superjson.serialize,
  shouldDehydrateQuery: (query: Query) =>
    defaultShouldDehydrateQuery(query) || query.state.status === 'pending'
}

const hydrate = {
  deserializeData: superjson.deserialize
}

type QueryRetry = typeof shouldRetryQuery | false

function createQueryClient(retry: QueryRetry) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME,
        gcTime: GC_TIME,
        retry,
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        refetchOnReconnect: true
      },
      dehydrate,
      hydrate
    }
  })
}

export function makeQueryClient() {
  return createQueryClient(shouldRetryQuery)
}

export function makeRscPrefetchQueryClient() {
  return createQueryClient(false)
}
