'use client'

import {
  type ListProblemsInputDTO,
  PROBLEM_PAGE_SIZES,
  PROBLEM_SORT_FIELDS,
  type ProblemSortField
} from '@backend/modules/task/endpoints/queries/list-problems/input.dto'
import { PROBLEM_DIFFICULTIES } from '@backend/modules/task/schema'
import { useEffect, useState } from 'react'
import { parseDifficulty, parsePageSize, parseSort } from './list-params'

const SORT_LABELS: Record<ProblemSortField, string> = {
  code: 'Code',
  title: 'Title',
  difficulty: 'Difficulty',
  rating: 'Rating',
  kind: 'Kind',
  solveCount: 'Solve count'
}

const DIFFICULTY_LABELS: Record<(typeof PROBLEM_DIFFICULTIES)[number], string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard'
}

const SEARCH_DEBOUNCE_MS = 300

type ProblemFiltersProps = {
  params: ListProblemsInputDTO
  tags: string[]
  kinds: string[]
  onChange: (partial: Partial<Omit<ListProblemsInputDTO, 'page'>>) => void
  hasActiveFilters: boolean
  onClear: () => void
}

const CONTROL_CLASS =
  'rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent'

/** Search, filters, sort, order and page size for the problem list - all Postgres-backed. */
export function ProblemFilters({
  params,
  tags,
  kinds,
  onChange,
  hasActiveFilters,
  onClear
}: ProblemFiltersProps) {
  const [searchDraft, setSearchDraft] = useState(params.search ?? '')

  // The URL is the source of truth (e.g. after Clear filters or the back button) -
  // keep the draft in sync whenever it changes from outside this input.
  useEffect(() => {
    setSearchDraft(params.search ?? '')
  }, [params.search])

  // params.search and onChange intentionally excluded from the dependency list:
  // including them would restart the debounce timer on every render triggered
  // by typing itself.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  useEffect(() => {
    const trimmed = searchDraft.trim()
    if (trimmed === (params.search ?? '')) return

    const timeoutId = setTimeout(() => {
      onChange({ search: trimmed.length > 0 ? trimmed : undefined })
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timeoutId)
  }, [searchDraft])

  return (
    <div className='flex flex-col gap-3 rounded-xl border border-border bg-card p-4'>
      <div className='flex flex-wrap gap-3'>
        <label className='flex min-w-48 flex-1 flex-col gap-1.5'>
          <span className='font-medium text-muted text-xs'>Search</span>
          <input
            type='text'
            value={searchDraft}
            onChange={event => setSearchDraft(event.target.value)}
            placeholder='Search by code or title'
            className={CONTROL_CLASS}
          />
        </label>

        <label className='flex flex-col gap-1.5'>
          <span className='font-medium text-muted text-xs'>Difficulty</span>
          <select
            value={params.difficulty ?? ''}
            onChange={event => onChange({ difficulty: parseDifficulty(event.target.value) })}
            className={CONTROL_CLASS}
          >
            <option value=''>All</option>
            {PROBLEM_DIFFICULTIES.map(difficulty => (
              <option key={difficulty} value={difficulty}>
                {DIFFICULTY_LABELS[difficulty]}
              </option>
            ))}
          </select>
        </label>

        <label className='flex flex-col gap-1.5'>
          <span className='font-medium text-muted text-xs'>Tag</span>
          <select
            value={params.tag ?? ''}
            onChange={event =>
              onChange({ tag: event.target.value === '' ? undefined : event.target.value })
            }
            className={CONTROL_CLASS}
          >
            <option value=''>All</option>
            {tags.map(tag => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>

        <label className='flex flex-col gap-1.5'>
          <span className='font-medium text-muted text-xs'>Kind</span>
          <select
            value={params.kind ?? ''}
            onChange={event =>
              onChange({ kind: event.target.value === '' ? undefined : event.target.value })
            }
            className={CONTROL_CLASS}
          >
            <option value=''>All</option>
            {kinds.map(kind => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className='flex flex-wrap items-end gap-3'>
        <label className='flex flex-col gap-1.5'>
          <span className='font-medium text-muted text-xs'>Sort by</span>
          <select
            value={params.sort}
            onChange={event => onChange({ sort: parseSort(event.target.value) })}
            className={CONTROL_CLASS}
          >
            {PROBLEM_SORT_FIELDS.map(field => (
              <option key={field} value={field}>
                {SORT_LABELS[field]}
              </option>
            ))}
          </select>
        </label>

        <label className='flex flex-col gap-1.5'>
          <span className='font-medium text-muted text-xs'>Order</span>
          <select
            value={params.order}
            onChange={event => onChange({ order: event.target.value === 'desc' ? 'desc' : 'asc' })}
            className={CONTROL_CLASS}
          >
            <option value='asc'>Ascending</option>
            <option value='desc'>Descending</option>
          </select>
        </label>

        <label className='flex flex-col gap-1.5'>
          <span className='font-medium text-muted text-xs'>Per page</span>
          <select
            value={params.pageSize}
            onChange={event => onChange({ pageSize: parsePageSize(event.target.value) })}
            className={CONTROL_CLASS}
          >
            {PROBLEM_PAGE_SIZES.map(size => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        {hasActiveFilters ? (
          <button type='button' onClick={onClear} className='text-accent text-sm hover:underline'>
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  )
}
