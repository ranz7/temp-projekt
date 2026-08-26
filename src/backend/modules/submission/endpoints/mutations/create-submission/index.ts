import { submission__submission_ } from '@backend/modules/submission/schema'
import {
  SUBMISSION_LANGUAGES,
  type SubmissionLanguage,
  task__problem_
} from '@backend/modules/task/schema'
import { protectedProcedure } from '@backend/trpc'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { CreateSubmissionInputDTOZ } from './input.dto'
import { CreateSubmissionOutputDTOZ } from './output.dto'

const LANGUAGE_LABELS: Record<SubmissionLanguage, string> = {
  python: 'Python',
  cpp: 'C++'
}

function isSubmissionLanguage(value: string): value is SubmissionLanguage {
  return SUBMISSION_LANGUAGES.some(language => language === value)
}

function describeLanguages(languages: SubmissionLanguage[]): string {
  return languages.map(language => LANGUAGE_LABELS[language]).join(' and ')
}

export const createSubmissionProcedure = protectedProcedure
  .meta({ operation: 'submission.createSubmission', procedureKind: 'mutation' })
  .input(CreateSubmissionInputDTOZ)
  .output(CreateSubmissionOutputDTOZ)
  .mutation(async ({ ctx, input }) => {
    const [problem] = await ctx.db
      .select({ id: task__problem_.id, languages: task__problem_.languages_ })
      .from(task__problem_)
      .where(eq(task__problem_.slug_, input.problemSlug))
      .limit(1)

    if (!problem) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'We could not find that problem.' })
    }

    if (!isSubmissionLanguage(input.language)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'A solution may be written in Python or C++ only.'
      })
    }

    const language = input.language

    if (!problem.languages.includes(language)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `This problem accepts ${describeLanguages(problem.languages)} only.`
      })
    }

    // Postgres hands out the id. The author is always the signed-in user, never a value
    // that arrived with the request.
    const [submission] = await ctx.db
      .insert(submission__submission_)
      .values({
        problem_id_: problem.id,
        user_id_: ctx.userId,
        language_: language,
        source_code_: input.sourceCode,
        status_: 'queued'
      })
      .returning({
        id: submission__submission_.id,
        status: submission__submission_.status_
      })

    // Nothing is told about it: the dispatcher looks at the queue itself and hands
    // this row to the next machine with room for it.
    return submission
  })
