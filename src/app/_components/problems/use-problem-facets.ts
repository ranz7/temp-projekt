'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTRPC } from '@/app/_trpc/config'

const FACETS_PAGE_SIZE = 100

export type ProblemFacets = {
  tags: string[]
  kinds: string[]
}

/**
 * Tag and kind choices pulled from the problems that actually exist, not a
 * hardcoded list. Fetches its own unfiltered page so the options never shrink
 * as the visitor filters the list.
 */
export function useProblemFacets(): ProblemFacets {
  const trpc = useTRPC()
  const facetsQuery = useQuery(trpc.task.listProblems.queryOptions({ pageSize: FACETS_PAGE_SIZE }))

  return useMemo(() => {
    const tags = new Set<string>()
    const kinds = new Set<string>()

    for (const problem of facetsQuery.data?.problems ?? []) {
      for (const tag of problem.tags) tags.add(tag)
      kinds.add(problem.kind)
    }

    return { tags: [...tags].sort(), kinds: [...kinds].sort() }
  }, [facetsQuery.data])
}
