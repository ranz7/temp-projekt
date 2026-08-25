import { SUBMISSION_LANGUAGES } from '@backend/modules/task/schema'
import { z } from 'zod'

export const ProblemRankingRowDTOZ = z.object({
  /** Position in this list, starting at 1 and dense. */
  rank: z.number().int().positive(),
  userId: z.uuid(),
  username: z.string(),
  /** The person's first accepted submission for this problem. */
  submissionId: z.uuid(),
  language: z.enum(SUBMISSION_LANGUAGES),
  /** When that first accepted submission was made. */
  solvedAt: z.date(),
  /** Points earned by that submission; null when the judge recorded none. */
  score: z.number().int().nullable()
})

export const GetProblemRankingOutputDTOZ = z.array(ProblemRankingRowDTOZ)

export type ProblemRankingRowDTO = z.infer<typeof ProblemRankingRowDTOZ>
export type GetProblemRankingOutputDTO = z.infer<typeof GetProblemRankingOutputDTOZ>
