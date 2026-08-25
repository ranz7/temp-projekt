import { PROBLEM_DIFFICULTIES } from '@backend/modules/task/schema'
import { z } from 'zod'

/** One row of the problem list. Statements and tests are not part of it. */
export const ProblemListItemDTOZ = z.object({
  id: z.uuid(),
  slug: z.string(),
  code: z.string(),
  title: z.string(),
  difficulty: z.enum(PROBLEM_DIFFICULTIES),
  rating: z.number().int().nullable(),
  tags: z.array(z.string()),
  kind: z.string(),
  timeLimitMs: z.number().int(),
  memoryLimitMb: z.number().int(),
  /** Distinct people with an accepted solution. */
  solveCount: z.number().int()
})

export const ListProblemsOutputDTOZ = z.object({
  problems: z.array(ProblemListItemDTOZ),
  /** Problems matching the filters, ignoring paging. */
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int()
})

export type ProblemListItemDTO = z.infer<typeof ProblemListItemDTOZ>
export type ListProblemsOutputDTO = z.infer<typeof ListProblemsOutputDTOZ>
