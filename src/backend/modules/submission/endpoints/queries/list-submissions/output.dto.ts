import { SUBMISSION_STATUSES } from '@backend/modules/submission/schema'
import { SUBMISSION_LANGUAGES } from '@backend/modules/task/schema'
import { z } from 'zod'

/**
 * What everybody may see about somebody else's submission. Strict on purpose:
 * source code, score and per-test rows belong to the author's own page only.
 */
export const SubmissionListRowDTOZ = z.strictObject({
  id: z.uuid(),
  problemSlug: z.string(),
  problemCode: z.string(),
  problemTitle: z.string(),
  username: z.string(),
  language: z.enum(SUBMISSION_LANGUAGES),
  status: z.enum(SUBMISSION_STATUSES),
  createdAt: z.date()
})

export const ListSubmissionsOutputDTOZ = z.strictObject({
  submissions: z.array(SubmissionListRowDTOZ),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive()
})

export type SubmissionListRowDTO = z.infer<typeof SubmissionListRowDTOZ>
export type ListSubmissionsOutputDTO = z.infer<typeof ListSubmissionsOutputDTOZ>
