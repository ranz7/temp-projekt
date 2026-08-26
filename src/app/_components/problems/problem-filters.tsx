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

const LABEL_CLASS = 'flex flex-col gap-1 font-medium text-muted text-xs'

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
    <div className='flex flex-col gap-3 border-divider border-b p-4 sm:px-5'>
      <div className='flex flex-col gap-3 lg:flex-row lg:items-end'>
        <label className={`${LABEL_CLASS} min-w-0 flex-1`}>
          Search code / title
          <input
            type='text'
            value={searchDraft}
            onChange={event => setSearchDraft(event.target.value)}
            placeholder='e.g. 4A or Watermelon'
            className='field'
          />
        </label>

        <label className={LABEL_CLASS}>
          Difficulty
          <select
            value={params.difficulty ?? ''}
            onChange={event => onChange({ difficulty: parseDifficulty(event.target.value) })}
            className='field'
          >
            <option value=''>All</option>
            {PROBLEM_DIFFICULTIES.map(difficulty => (
              <option key={difficulty} value={difficulty}>
                {DIFFICULTY_LABELS[difficulty]}
              </option>
            ))}
          </select>
        </label>

        <label className={LABEL_CLASS}>
          Tag
          <select
            value={params.tag ?? ''}
            onChange={event =>
              onChange({ tag: event.target.value === '' ? undefined : event.target.value })
            }
            className='field'
          >
            <option value=''>All</option>
            {tags.map(tag => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>

        <label className={LABEL_CLASS}>
          Kind
          <select
            value={params.kind ?? ''}
            onChange={event =>
              onChange({ kind: event.target.value === '' ? undefined : event.target.value })
            }
            className='field'
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

      <div className='flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end'>
        <label className={LABEL_CLASS}>
          Sort by
          <select
            value={params.sort}
            onChange={event => onChange({ sort: parseSort(event.target.value) })}
            className='field'
          >
            {PROBLEM_SORT_FIELDS.map(field => (
              <option key={field} value={field}>
                {SORT_LABELS[field]}
              </option>
            ))}
          </select>
        </label>

        <label className={LABEL_CLASS}>
          Order
          <select
            value={params.order}
            onChange={event => onChange({ order: event.target.value === 'desc' ? 'desc' : 'asc' })}
            className='field'
          >
            <option value='asc'>Ascending</option>
            <option value='desc'>Descending</option>
          </select>
        </label>

        <label className={LABEL_CLASS}>
          Page size
          <select
            value={params.pageSize}
            onChange={event => onChange({ pageSize: parsePageSize(event.target.value) })}
            className='field'
          >
            {PROBLEM_PAGE_SIZES.map(size => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        {hasActiveFilters ? (
          <button type='button' onClick={onClear} className='btn-secondary mt-auto'>
            Reset filters
          </button>
        ) : null}
      </div>
    </div>
  )
}
