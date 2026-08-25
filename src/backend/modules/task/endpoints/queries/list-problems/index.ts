import { solveCountSql } from '@backend/modules/task/internal-functions/problem-counts'
import { task__problem_ } from '@backend/modules/task/schema'
import { publicProcedure } from '@backend/trpc'
import { and, arrayContains, asc, count, desc, eq, ilike, or, type SQL, sql } from 'drizzle-orm'
import type { SQLWrapper } from 'drizzle-orm/sql'
import { ListProblemsInputDTOZ, type ProblemSortField } from './input.dto'
import { ListProblemsOutputDTOZ } from './output.dto'

/** Keeps a `%` or `_` typed by a visitor a literal character rather than a wildcard. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, character => `\\${character}`)
}

/** easy before medium before hard - the meaningful order, not the alphabet. */
const difficultyRank = sql`case ${task__problem_.difficulty_}
  when 'easy' then 1
  when 'medium' then 2
  when 'hard' then 3
  else 4
end`

function sortTarget(sort: ProblemSortField): SQLWrapper {
  switch (sort) {
    case 'title':
      return task__problem_.title_
    case 'difficulty':
      return difficultyRank
    case 'rating':
      return task__problem_.rating_
    case 'kind':
      return task__problem_.kind_
    case 'solveCount':
      return solveCountSql()
    default:
      return task__problem_.code_
  }
}

export const listProblemsProcedure = publicProcedure
  .meta({ operation: 'task.listProblems', procedureKind: 'query' })
  .input(ListProblemsInputDTOZ)
  .output(ListProblemsOutputDTOZ)
  .query(async ({ ctx, input }) => {
    const conditions: SQL[] = [eq(task__problem_.is_published_, true)]

    if (input.search !== undefined) {
      const pattern = `%${escapeLikePattern(input.search)}%`
      const matchesCodeOrTitle = or(
        ilike(task__problem_.code_, pattern),
        ilike(task__problem_.title_, pattern)
      )

      if (matchesCodeOrTitle) conditions.push(matchesCodeOrTitle)
    }

    if (input.difficulty !== undefined) {
      conditions.push(eq(task__problem_.difficulty_, input.difficulty))
    }

    if (input.tag !== undefined) {
      conditions.push(arrayContains(task__problem_.tags_, [input.tag]))
    }

    if (input.kind !== undefined) {
      conditions.push(eq(task__problem_.kind_, input.kind))
    }

    const filter = and(...conditions)
    const direction = input.order === 'desc' ? desc : asc

    // Filtering, sorting, counting and paging all stay in Postgres.
    const problems = await ctx.db
      .select({
        id: task__problem_.id,
        slug: task__problem_.slug_,
        code: task__problem_.code_,
        title: task__problem_.title_,
        difficulty: task__problem_.difficulty_,
        rating: task__problem_.rating_,
        tags: task__problem_.tags_,
        kind: task__problem_.kind_,
        timeLimitMs: task__problem_.time_limit_ms_,
        memoryLimitMb: task__problem_.memory_limit_mb_,
        solveCount: solveCountSql()
      })
      .from(task__problem_)
      .where(filter)
      // `id` breaks ties so a row never slips between pages.
      .orderBy(direction(sortTarget(input.sort)), asc(task__problem_.id))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize)

    const [totals] = await ctx.db.select({ total: count() }).from(task__problem_).where(filter)

    return {
      problems,
      total: totals?.total ?? 0,
      page: input.page,
      pageSize: input.pageSize
    }
  })
