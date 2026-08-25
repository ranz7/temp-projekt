import { account__user_ } from '@backend/modules/account/schema'
import { submission__submission_ } from '@backend/modules/submission/schema'
import { task__problem_ } from '@backend/modules/task/schema'
import { publicProcedure } from '@backend/trpc'
import { TRPCError } from '@trpc/server'
import { and, asc, eq, sql } from 'drizzle-orm'
import { GetProblemRankingInputDTOZ } from './input.dto'
import { GetProblemRankingOutputDTOZ } from './output.dto'

export const getProblemRankingProcedure = publicProcedure
  .meta({ operation: 'ranking.getProblemRanking', procedureKind: 'query' })
  .input(GetProblemRankingInputDTOZ)
  .output(GetProblemRankingOutputDTOZ)
  .query(async ({ ctx, input }) => {
    const [problem] = await ctx.db
      .select({ id: task__problem_.id })
      .from(task__problem_)
      .where(and(eq(task__problem_.slug_, input.slug), eq(task__problem_.is_published_, true)))
      .limit(1)

    // A problem nobody can see is the same as no problem at all.
    if (!problem) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'No such problem.' })
    }

    // Number each person's accepted submissions oldest first, so number 1 is the
    // one that first solved the problem for them.
    const acceptedSolve = ctx.db.$with('accepted_solve_').as(
      ctx.db
        .select({
          submissionId: submission__submission_.id,
          userId: submission__submission_.user_id_,
          language: submission__submission_.language_,
          score: submission__submission_.score_,
          solvedAt: submission__submission_.created_at_,
          attempt: sql<number>`row_number() over (
            partition by ${submission__submission_.user_id_}
            order by ${submission__submission_.created_at_} asc, ${submission__submission_.id} asc
          )`.as('attempt_')
        })
        .from(submission__submission_)
        .where(
          and(
            eq(submission__submission_.problem_id_, problem.id),
            eq(submission__submission_.status_, 'accepted')
          )
        )
    )

    const rows = await ctx.db
      .with(acceptedSolve)
      .select({
        userId: acceptedSolve.userId,
        username: account__user_.username_,
        submissionId: acceptedSolve.submissionId,
        language: acceptedSolve.language,
        solvedAt: acceptedSolve.solvedAt,
        score: acceptedSolve.score
      })
      .from(acceptedSolve)
      .innerJoin(account__user_, eq(account__user_.id, acceptedSolve.userId))
      .where(eq(acceptedSolve.attempt, 1))
      .orderBy(asc(acceptedSolve.solvedAt), asc(acceptedSolve.submissionId))
      .limit(input.limit)

    return rows.map((row, index) => ({ ...row, rank: index + 1 }))
  })
