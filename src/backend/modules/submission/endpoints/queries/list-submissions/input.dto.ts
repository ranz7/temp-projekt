import { z } from 'zod'

export const SUBMISSION_PAGE_SIZE_DEFAULT = 25
export const SUBMISSION_PAGE_SIZE_MAX = 100

export const SubmissionPagingDTOZ = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z
    .number()
    .int()
    .positive()
    .max(SUBMISSION_PAGE_SIZE_MAX)
    .default(SUBMISSION_PAGE_SIZE_DEFAULT)
})

export const ListSubmissionsInputDTOZ = SubmissionPagingDTOZ.extend({
  /** Left out, the feed shows every problem's submissions. */
  problemSlug: z.string().min(1).max(128).optional()
})

export type ListSubmissionsInputDTO = z.infer<typeof ListSubmissionsInputDTOZ>
