import { PROBLEM_DIFFICULTIES, SUBMISSION_LANGUAGES } from '@backend/modules/task/schema'
import { z } from 'zod'

/**
 * A public sample: the only test whose input and expected output ever leave the
 * server. There is deliberately no shape here that a hidden test could fit -
 * no file names, no expected output for anything but a sample.
 */
export const ProblemSampleDTOZ = z.object({
  ordinal: z.number().int(),
  input: z.string(),
  expectedOutput: z.string(),
  explanation: z.string().nullable()
})

export const GetProblemOutputDTOZ = z.object({
  id: z.uuid(),
  slug: z.string(),
  code: z.string(),
  title: z.string(),
  statement: z.string(),
  statementInput: z.string().nullable(),
  statementOutput: z.string().nullable(),
  statementNotes: z.string().nullable(),
  difficulty: z.enum(PROBLEM_DIFFICULTIES),
  rating: z.number().int().nullable(),
  tags: z.array(z.string()),
  kind: z.string(),
  ioMode: z.string(),
  languages: z.array(z.enum(SUBMISSION_LANGUAGES)),
  timeLimitMs: z.number().int(),
  memoryLimitMb: z.number().int(),
  /** Distinct people with an accepted solution. */
  solveCount: z.number().int(),
  /** How many hidden tests there are - never what is in them. */
  hiddenTestCount: z.number().int(),
  samples: z.array(ProblemSampleDTOZ)
})

export type ProblemSampleDTO = z.infer<typeof ProblemSampleDTOZ>
export type GetProblemOutputDTO = z.infer<typeof GetProblemOutputDTOZ>
