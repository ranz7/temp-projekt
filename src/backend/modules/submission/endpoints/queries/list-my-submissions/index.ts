import { findSubmissionPage } from '@backend/modules/submission/internal-functions/submission-list'
import { protectedProcedure } from '@backend/trpc'
import { ListMySubmissionsInputDTOZ } from './input.dto'
import { ListMySubmissionsOutputDTOZ, type MySubmissionListRowDTO } from './output.dto'

export const listMySubmissionsProcedure = protectedProcedure
  .meta({ operation: 'submission.listMySubmissions', procedureKind: 'query' })
  .input(ListMySubmissionsInputDTOZ)
  .output(ListMySubmissionsOutputDTOZ)
  .query(async ({ ctx, input }) => {
    // Always the signed-in person: the list never takes a user from the request.
    const { rows, total } = await findSubmissionPage(
      ctx.db,
      { problemSlug: input.problemSlug, userId: ctx.userId },
      { page: input.page, pageSize: input.pageSize }
    )

    const submissions: MySubmissionListRowDTO[] = rows.map(row => ({
      id: row.id,
      problemSlug: row.problemSlug,
      problemCode: row.problemCode,
      problemTitle: row.problemTitle,
      username: row.username,
      language: row.language,
      status: row.status,
      createdAt: row.createdAt,
      score: row.score,
      maxScore: row.maxScore
    }))

    return { submissions, total, page: input.page, pageSize: input.pageSize }
  })
