'use client'

import type { ListProblemsInputDTO } from '@backend/modules/task/endpoints/queries/list-problems/input.dto'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/app/_components/cn'
import { EmptyState } from '@/app/_components/empty-state'
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
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const params = parseProblemListParams(Object.fromEntries(searchParams.entries()))
  const facets = useProblemFacets()

  const listQuery = useQuery({
    ...trpc.task.listProblems.queryOptions(params),
    placeholderData: keepPreviousData
  })

  function navigate(next: ListProblemsInputDTO) {
    const query = buildProblemListSearchParams(next).toString()
    router.push(query.length > 0 ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  function updateFilters(partial: Partial<Omit<ListProblemsInputDTO, 'page'>>) {
    navigate({ ...params, ...partial, page: 1 })
  }

  function setPage(page: number) {
    navigate({ ...params, page })
  }

  function clearFilters() {
    navigate({
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

  return (
    <div className='flex flex-col gap-4'>
      <ProblemFilters
        params={params}
        tags={facets.tags}
        kinds={facets.kinds}
        onChange={updateFilters}
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
      />

      {listQuery.isError ? (
        <ErrorState description='Could not load problems. Try reloading the page.' />
      ) : listQuery.data === undefined ? (
        <ProblemTableSkeleton />
      ) : listQuery.data.problems.length === 0 ? (
        <EmptyState
          title='No problems match these filters.'
          description={
            hasActiveFilters ? 'Try a different search or clear the filters.' : undefined
          }
        />
      ) : (
        <div className={cn(listQuery.isFetching && 'opacity-60 transition-opacity')}>
          <ProblemTable problems={listQuery.data.problems} />
        </div>
      )}

      {listQuery.data !== undefined && listQuery.data.problems.length > 0 ? (
        <ProblemPagination
          page={listQuery.data.page}
          pageSize={listQuery.data.pageSize}
          total={listQuery.data.total}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  )
}
