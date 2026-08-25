import { SubmissionPagingDTOZ } from '@backend/modules/submission/endpoints/queries/list-submissions/input.dto'
import { z } from 'zod'

export const ListMySubmissionsInputDTOZ = SubmissionPagingDTOZ.extend({
  /** Left out, the list shows your submissions to every problem. */
  problemSlug: z.string().min(1).max(128).optional()
})

export type ListMySubmissionsInputDTO = z.infer<typeof ListMySubmissionsInputDTOZ>
