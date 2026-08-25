import { findSubmissionPage } from '@backend/modules/submission/internal-functions/submission-list'
import { publicProcedure } from '@backend/trpc'
import { ListSubmissionsInputDTOZ } from './input.dto'
import { ListSubmissionsOutputDTOZ, type SubmissionListRowDTO } from './output.dto'

export const listSubmissionsProcedure = publicProcedure
  .meta({ operation: 'submission.listSubmissions', procedureKind: 'query' })
  .input(ListSubmissionsInputDTOZ)
  .output(ListSubmissionsOutputDTOZ)
  .query(async ({ ctx, input }) => {
    const { rows, total } = await findSubmissionPage(
      ctx.db,
      { problemSlug: input.problemSlug },
      { page: input.page, pageSize: input.pageSize }
    )

    // Built field by field: the public feed says who solved what and how it went,
    // never what they wrote or scored.
    const submissions: SubmissionListRowDTO[] = rows.map(row => ({
      id: row.id,
      problemSlug: row.problemSlug,
      problemCode: row.problemCode,
      problemTitle: row.problemTitle,
      username: row.username,
      language: row.language,
      status: row.status,
      createdAt: row.createdAt
    }))

    return { submissions, total, page: input.page, pageSize: input.pageSize }
  })
