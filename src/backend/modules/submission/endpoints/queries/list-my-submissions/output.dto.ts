import { SubmissionListRowDTOZ } from '@backend/modules/submission/endpoints/queries/list-submissions/output.dto'
import { z } from 'zod'

/** Your own row also carries what you scored; still no source code or test rows. */
export const MySubmissionListRowDTOZ = SubmissionListRowDTOZ.extend({
  score: z.number().int().nullable(),
  maxScore: z.number().int().nullable()
})

export const ListMySubmissionsOutputDTOZ = z.strictObject({
  submissions: z.array(MySubmissionListRowDTOZ),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive()
})

export type MySubmissionListRowDTO = z.infer<typeof MySubmissionListRowDTOZ>
export type ListMySubmissionsOutputDTO = z.infer<typeof ListMySubmissionsOutputDTOZ>
