import { PROBLEM_DIFFICULTIES } from '@backend/modules/task/schema'
import { z } from 'zod'

/** Columns the problem list may be ordered by. */
export const PROBLEM_SORT_FIELDS = [
  'code',
  'title',
  'difficulty',
  'rating',
  'kind',
  'solveCount'
] as const
export type ProblemSortField = (typeof PROBLEM_SORT_FIELDS)[number]

export const PROBLEM_PAGE_SIZES = [25, 50, 100] as const
export type ProblemPageSize = (typeof PROBLEM_PAGE_SIZES)[number]

export const ListProblemsInputDTOZ = z
  .object({
    /** Part of a problem's code or title. Capitals are ignored. */
    search: z.string().trim().min(1).max(128).optional(),
    difficulty: z.enum(PROBLEM_DIFFICULTIES).optional(),
    tag: z.string().trim().min(1).max(64).optional(),
    kind: z.string().trim().min(1).max(32).optional(),
    sort: z.enum(PROBLEM_SORT_FIELDS).default('code'),
    order: z.enum(['asc', 'desc']).default('asc'),
    page: z.number().int().min(1).default(1),
    pageSize: z.union([z.literal(25), z.literal(50), z.literal(100)]).default(50)
  })
  .prefault({})

export type ListProblemsInputDTO = z.infer<typeof ListProblemsInputDTOZ>
