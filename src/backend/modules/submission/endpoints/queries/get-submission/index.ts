import {
  submission__submission_,
  submission__test_result_
} from '@backend/modules/submission/schema'
import { task__problem_, task__problem_test_ } from '@backend/modules/task/schema'
import { publicProcedure } from '@backend/trpc'
import { TRPCError } from '@trpc/server'
import { eq, sql } from 'drizzle-orm'
import { GetSubmissionInputDTOZ } from './input.dto'
import { GetSubmissionOutputDTOZ, type SubmissionTestDTO } from './output.dto'

type TestRow = {
  ordinal: number
  visibility: 'public' | 'hidden'
  verdict: SubmissionTestDTO['verdict']
  passed: boolean
  pointsAwarded: number
  timeMs: number | null
  memoryKb: number | null
  presses: number | null
  message: string | null
  actualOutput: string | null
  input: string | null
  expectedOutput: string | null
}

/** Samples first, then the hidden tests, each block in its own numbering. */
const testOrder = sql`case ${submission__test_result_.visibility_} when 'public' then 0 else 1 end`

function toTestEntry(row: TestRow): SubmissionTestDTO {
  const shared = {
    ordinal: row.ordinal,
    verdict: row.verdict,
    passed: row.passed,
    pointsAwarded: row.pointsAwarded,
    timeMs: row.timeMs,
    memoryKb: row.memoryKb,
    // Says what the person's own solution did, not what the test holds, so it is safe
    // on a hidden test as well.
    presses: row.presses
  }

  if (row.visibility === 'public') {
    return {
      ...shared,
      visibility: 'public',
      input: row.input,
      expectedOutput: row.expectedOutput,
      actualOutput: row.actualOutput,
      message: row.message
    }
  }

  // Nothing about what a hidden test contains or produced ever leaves here.
  return { ...shared, visibility: 'hidden' }
}

export const getSubmissionProcedure = publicProcedure
  .meta({ operation: 'submission.getSubmission', procedureKind: 'query' })
  .input(GetSubmissionInputDTOZ)
  .output(GetSubmissionOutputDTOZ)
  .query(async ({ ctx, input }) => {
    const [submission] = await ctx.db
      .select({
        authorId: submission__submission_.user_id_,
        id: submission__submission_.id,
        problemSlug: task__problem_.slug_,
        problemCode: task__problem_.code_,
        problemTitle: task__problem_.title_,
        language: submission__submission_.language_,
        status: submission__submission_.status_,
        score: submission__submission_.score_,
        maxScore: submission__submission_.max_score_,
        compileMessage: submission__submission_.compile_message_,
        judgeMessage: submission__submission_.judge_message_,
        maxCpuMs: submission__submission_.max_cpu_ms_,
        maxMemoryKb: submission__submission_.max_memory_kb_,
        createdAt: submission__submission_.created_at_,
        judgedAt: submission__submission_.judged_at_,
        sourceCode: submission__submission_.source_code_
      })
      .from(submission__submission_)
      .innerJoin(task__problem_, eq(task__problem_.id, submission__submission_.problem_id_))
      .where(eq(submission__submission_.id, input.id))
      .limit(1)

    if (!submission) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'We could not find that submission.' })
    }

    const { authorId, ...detail } = submission

    // A solution belongs to the person who wrote it - nobody else opens this page,
    // signed in or not.
    if (authorId !== ctx.userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only the author of a submission can open it.'
      })
    }

    const testRows = await ctx.db
      .select({
        ordinal: submission__test_result_.ordinal_,
        visibility: submission__test_result_.visibility_,
        verdict: submission__test_result_.verdict_,
        passed: submission__test_result_.passed_,
        pointsAwarded: submission__test_result_.points_awarded_,
        timeMs: submission__test_result_.time_ms_,
        memoryKb: submission__test_result_.memory_kb_,
        presses: submission__test_result_.presses_,
        message: submission__test_result_.message_,
        actualOutput: submission__test_result_.actual_output_,
        input: task__problem_test_.input_,
        expectedOutput: task__problem_test_.expected_output_
      })
      .from(submission__test_result_)
      .innerJoin(
        task__problem_test_,
        eq(task__problem_test_.id, submission__test_result_.problem_test_id_)
      )
      .where(eq(submission__test_result_.submission_id_, submission.id))
      .orderBy(testOrder, submission__test_result_.ordinal_)

    return { ...detail, tests: testRows.map(toTestEntry) }
  })
