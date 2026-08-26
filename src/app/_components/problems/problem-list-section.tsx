'use client'

import type { ListProblemsInputDTO } from '@backend/modules/task/endpoints/queries/list-problems/input.dto'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/app/_components/cn'
import { ErrorState } from '@/app/_components/error-state'
import { useTRPC } from '@/app/_trpc/config'
import { buildProblemListSearchParams, parseProblemListParams } from './list-params'
import { ProblemFilters } from './problem-filters'
import { ProblemPagination } from './problem-pagination'
import { ProblemTable } from './problem-table'
import { ProblemTableSkeleton } from './problem-table-skeleton'
import { useProblemFacets } from './use-problem-facets'

/** The problem list: search, filters, sort, paging and results, all driven by the URL. */
export function ProblemListSection() {
  const trpc = useTRPC()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Seeded once from the URL Next.js resolved for this render (matches the
  // server's prefetch exactly). From here on this component's own state - not
  // `useSearchParams()` - drives the query and the address bar: every result
  // on this page already comes from this client query, so a filter change
  // only needs a new tRPC call, never a full server re-render of the page
  // (which would needlessly redo the activity panel's own database reads too).
  const [params, setParams] = useState<ListProblemsInputDTO>(() =>
    parseProblemListParams(Object.fromEntries(searchParams.entries()))
  )

  // The one case this component doesn't drive itself: the back/forward
  // buttons change the URL outside of `setParamsAndUrl` below, so resync from
  // whatever Next.js resolved for that real navigation.
  useEffect(() => {
    setParams(parseProblemListParams(Object.fromEntries(searchParams.entries())))
  }, [searchParams])

  const facets = useProblemFacets()

  const listQuery = useQuery({
    ...trpc.task.listProblems.queryOptions(params),
    placeholderData: keepPreviousData
  })

  // Updates local state immediately (so the query and the table redraw right
  // away) and syncs the address bar via the raw History API - not
  // `router.push` - so this stays a shareable, reload-safe URL without asking
  // the server to re-render the whole page for what is otherwise a pure
  // client-side re-fetch.
  function setParamsAndUrl(next: ListProblemsInputDTO) {
    setParams(next)
    const query = buildProblemListSearchParams(next).toString()
    const url = query.length > 0 ? `${pathname}?${query}` : pathname
    window.history.pushState(null, '', url)
  }

  function updateFilters(partial: Partial<Omit<ListProblemsInputDTO, 'page'>>) {
    setParamsAndUrl({ ...params, ...partial, page: 1 })
  }

  function setPage(page: number) {
    setParamsAndUrl({ ...params, page })
  }

  function clearFilters() {
    setParamsAndUrl({
      ...params,
      search: undefined,
      difficulty: undefined,
      tag: undefined,
      kind: undefined,
      page: 1
    })
  }

  const hasActiveFilters =
    params.search !== undefined ||
    params.difficulty !== undefined ||
    params.tag !== undefined ||
    params.kind !== undefined

  const list = listQuery.data
  const from = list === undefined || list.total === 0 ? 0 : (list.page - 1) * list.pageSize + 1
  const to = list === undefined ? 0 : Math.min(list.page * list.pageSize, list.total)
  const totalPages = list === undefined ? 1 : Math.max(1, Math.ceil(list.total / list.pageSize))

  return (
    <div className='card'>
      <ProblemFilters
        params={params}
        tags={facets.tags}
        kinds={facets.kinds}
        onChange={updateFilters}
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
      />

      <div className='flex flex-wrap items-center justify-between gap-2 border-divider border-b px-4 py-2 text-muted text-xs sm:px-5'>
        <span className={cn(listQuery.isFetching && 'opacity-60')}>
          Showing{' '}
          <span className='font-medium text-foreground tabular-nums'>
            {from}-{to}
          </span>{' '}
          of <span className='font-medium text-foreground tabular-nums'>{list?.total ?? 0}</span>{' '}
          matches
          {listQuery.isFetching ? ' - updating...' : null}
        </span>
        <span>
          Page{' '}
          <span className='text-foreground tabular-nums'>
            {list?.page ?? 1}/{totalPages}
          </span>
        </span>
      </div>

      {listQuery.isError ? (
        <ErrorState description='Could not load problems. Try reloading the page.' />
      ) : list === undefined ? (
        <ProblemTableSkeleton />
      ) : list.problems.length === 0 ? (
        <p className='px-4 py-6 text-muted text-sm sm:px-5'>
          {hasActiveFilters
            ? 'No problems match these filters. Try a different search or reset them.'
            : 'No problems yet.'}
        </p>
      ) : (
        <div className={cn(listQuery.isFetching && 'opacity-60 transition-opacity')}>
          <ProblemTable problems={list.problems} />
        </div>
      )}

      {list !== undefined ? (
        <ProblemPagination
          page={list.page}
          pageSize={list.pageSize}
          total={list.total}
          onPageChange={setPage}
          disabled={listQuery.isFetching}
        />
      ) : null}
    </div>
  )
}
