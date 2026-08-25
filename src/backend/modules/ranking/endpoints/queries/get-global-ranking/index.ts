import { account__user_ } from '@backend/modules/account/schema'
import { submission__submission_ } from '@backend/modules/submission/schema'
import { publicProcedure } from '@backend/trpc'
import { asc, desc, eq, sql } from 'drizzle-orm'
import { GetGlobalRankingInputDTOZ } from './input.dto'
import { GetGlobalRankingOutputDTOZ } from './output.dto'

export const getGlobalRankingProcedure = publicProcedure
  .meta({ operation: 'ranking.getGlobalRanking', procedureKind: 'query' })
  .input(GetGlobalRankingInputDTOZ)
  .output(GetGlobalRankingOutputDTOZ)
  .query(async ({ ctx, input }) => {
    // One row per person per problem they ever solved, carrying the moment they
    // first solved it. Solving the same problem twice therefore counts once.
    const firstSolve = ctx.db.$with('first_solve_').as(
      ctx.db
        .select({
          userId: submission__submission_.user_id_,
          problemId: submission__submission_.problem_id_,
          solvedAt: sql<Date>`min(${submission__submission_.created_at_})`.as('solved_at_')
        })
        .from(submission__submission_)
        .where(eq(submission__submission_.status_, 'accepted'))
        .groupBy(submission__submission_.user_id_, submission__submission_.problem_id_)
    )

    const solvedCount = sql<number>`count(*)::int`
    // The moment a person reached their current count - the last of their first solves.
    // Equal counts go to whoever got there earlier.
    const reachedAt = sql`max(${firstSolve.solvedAt})`

    // Only people who appear in first_solve_ are listed, so someone with no
    // accepted submission never shows up.
    const rows = await ctx.db
      .with(firstSolve)
      .select({
        userId: account__user_.id,
        username: account__user_.username_,
        solvedCount: solvedCount.as('solved_count_')
      })
      .from(firstSolve)
      .innerJoin(account__user_, eq(account__user_.id, firstSolve.userId))
      .groupBy(account__user_.id, account__user_.username_)
      .orderBy(desc(solvedCount), asc(reachedAt), asc(account__user_.id))
      .limit(input.limit)

    return rows.map((row, index) => ({ ...row, rank: index + 1 }))
  })
