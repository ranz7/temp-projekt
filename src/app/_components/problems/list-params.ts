import {
  type ListProblemsInputDTO,
  PROBLEM_PAGE_SIZES,
  PROBLEM_SORT_FIELDS,
  type ProblemPageSize,
  type ProblemSortField
} from '@backend/modules/task/endpoints/queries/list-problems/input.dto'
import { PROBLEM_DIFFICULTIES, type ProblemDifficulty } from '@backend/modules/task/schema'

/** Next.js's `searchParams` prop shape on the server; `useSearchParams().entries()` on the client. */
export type RawSearchParams = Record<string, string | string[] | undefined>

const DEFAULT_SORT: ProblemSortField = 'code'
const DEFAULT_ORDER = 'asc'
const DEFAULT_PAGE_SIZE: ProblemPageSize = 50

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function parseTrimmed(value: string | undefined, maxLength: number): string | undefined {
  const trimmed = value?.trim()
  if (trimmed === undefined || trimmed.length === 0) return undefined
  return trimmed.slice(0, maxLength)
}

/** Narrows an arbitrary string to a known difficulty, or `undefined` for "All". */
export function parseDifficulty(value: string | undefined): ProblemDifficulty | undefined {
  return PROBLEM_DIFFICULTIES.find(difficulty => difficulty === value)
}

/** Narrows an arbitrary string to a known sort field, falling back to the default. */
export function parseSort(value: string | undefined): ProblemSortField {
  return PROBLEM_SORT_FIELDS.find(field => field === value) ?? DEFAULT_SORT
}

function parseOrder(value: string | undefined): 'asc' | 'desc' {
  return value === 'desc' ? 'desc' : DEFAULT_ORDER
}

function parsePage(value: string | undefined): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1
}

/** Narrows an arbitrary string to one of the three allowed page sizes. */
export function parsePageSize(value: string | undefined): ProblemPageSize {
  const parsed = Number(value)
  return PROBLEM_PAGE_SIZES.find(size => size === parsed) ?? DEFAULT_PAGE_SIZE
}

/**
 * Reads the problem list's search, filters, sort and paging straight from the
 * URL query string - the single source of truth for what the list shows.
 */
export function parseProblemListParams(raw: RawSearchParams): ListProblemsInputDTO {
  return {
    search: parseTrimmed(firstValue(raw.search), 128),
    difficulty: parseDifficulty(firstValue(raw.difficulty)),
    tag: parseTrimmed(firstValue(raw.tag), 64),
    kind: parseTrimmed(firstValue(raw.kind), 32),
    sort: parseSort(firstValue(raw.sort)),
    order: parseOrder(firstValue(raw.order)),
    page: parsePage(firstValue(raw.page)),
    pageSize: parsePageSize(firstValue(raw.pageSize))
  }
}

/** Serializes filters back into a query string, omitting values already at their default. */
export function buildProblemListSearchParams(params: ListProblemsInputDTO): URLSearchParams {
  const search = new URLSearchParams()

  if (params.search !== undefined) search.set('search', params.search)
  if (params.difficulty !== undefined) search.set('difficulty', params.difficulty)
  if (params.tag !== undefined) search.set('tag', params.tag)
  if (params.kind !== undefined) search.set('kind', params.kind)
  if (params.sort !== DEFAULT_SORT) search.set('sort', params.sort)
  if (params.order !== DEFAULT_ORDER) search.set('order', params.order)
  if (params.page !== 1) search.set('page', String(params.page))
  if (params.pageSize !== DEFAULT_PAGE_SIZE) search.set('pageSize', String(params.pageSize))

  return search
}
