import {
  hiddenTestCountSql,
  solveCountSql
} from '@backend/modules/task/internal-functions/problem-counts'
import { task__problem_, task__problem_test_ } from '@backend/modules/task/schema'
import { publicProcedure } from '@backend/trpc'
import { TRPCError } from '@trpc/server'
import { and, asc, eq } from 'drizzle-orm'
import { GetProblemInputDTOZ } from './input.dto'
import { GetProblemOutputDTOZ } from './output.dto'

export const getProblemProcedure = publicProcedure
  .meta({ operation: 'task.getProblem', procedureKind: 'query' })
  .input(GetProblemInputDTOZ)
  .output(GetProblemOutputDTOZ)
  .query(async ({ ctx, input }) => {
    const [problem] = await ctx.db
      .select({
        id: task__problem_.id,
        slug: task__problem_.slug_,
        code: task__problem_.code_,
        title: task__problem_.title_,
        statement: task__problem_.statement_,
        statementMarkdown: task__problem_.statement_markdown_,
        statementInput: task__problem_.statement_input_,
        statementOutput: task__problem_.statement_output_,
        statementNotes: task__problem_.statement_notes_,
        difficulty: task__problem_.difficulty_,
        rating: task__problem_.rating_,
        tags: task__problem_.tags_,
        kind: task__problem_.kind_,
        ioMode: task__problem_.io_mode_,
        languages: task__problem_.languages_,
        timeLimitMs: task__problem_.time_limit_ms_,
        memoryLimitMb: task__problem_.memory_limit_mb_,
        solveCount: solveCountSql(),
        hiddenTestCount: hiddenTestCountSql()
      })
      .from(task__problem_)
      .where(and(eq(task__problem_.slug_, input.slug), eq(task__problem_.is_published_, true)))
      .limit(1)

    if (!problem) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'No such problem.' })
    }

    // Public tests only. Hidden rows are never read, so their file names cannot
    // reach this query's result in the first place.
    const samples = await ctx.db
      .select({
        ordinal: task__problem_test_.ordinal_,
        input: task__problem_test_.input_,
        expectedOutput: task__problem_test_.expected_output_,
        explanation: task__problem_test_.explanation_
      })
      .from(task__problem_test_)
      .where(
        and(
          eq(task__problem_test_.problem_id_, problem.id),
          eq(task__problem_test_.visibility_, 'public')
        )
      )
      .orderBy(asc(task__problem_test_.ordinal_))

    return {
      ...problem,
      samples: samples.map(sample => ({
        ordinal: sample.ordinal,
        input: sample.input ?? '',
        expectedOutput: sample.expectedOutput ?? '',
        explanation: sample.explanation
      }))
    }
  })
