import { SUBMISSION_STATUSES, TEST_VERDICTS } from '@backend/modules/submission/schema'
import { SUBMISSION_LANGUAGES } from '@backend/modules/task/schema'
import { z } from 'zod'

const submissionTestShape = {
  ordinal: z.number().int().positive(),
  verdict: z.enum(TEST_VERDICTS),
  passed: z.boolean(),
  pointsAwarded: z.number().int().nonnegative(),
  timeMs: z.number().int().nonnegative().nullable(),
  memoryKb: z.number().int().nonnegative().nullable()
}

/**
 * A hidden test shows its number, verdict, time and memory and nothing else.
 * The object is strict on purpose: a row that smuggled in an input or an actual
 * output fails to leave the endpoint instead of quietly reaching the page.
 */
export const HiddenSubmissionTestDTOZ = z.strictObject({
  ...submissionTestShape,
  visibility: z.literal('hidden')
})

/** A sample the problem page already shows, so its data is safe to repeat here. */
export const PublicSubmissionTestDTOZ = z.strictObject({
  ...submissionTestShape,
  visibility: z.literal('public'),
  input: z.string().nullable(),
  expectedOutput: z.string().nullable(),
  actualOutput: z.string().nullable(),
  message: z.string().nullable()
})

export const SubmissionTestDTOZ = z.discriminatedUnion('visibility', [
  PublicSubmissionTestDTOZ,
  HiddenSubmissionTestDTOZ
])

export const GetSubmissionOutputDTOZ = z.strictObject({
  id: z.uuid(),
  problemSlug: z.string(),
  problemCode: z.string(),
  problemTitle: z.string(),
  language: z.enum(SUBMISSION_LANGUAGES),
  status: z.enum(SUBMISSION_STATUSES),
  score: z.number().int().nullable(),
  maxScore: z.number().int().nullable(),
  compileMessage: z.string().nullable(),
  judgeMessage: z.string().nullable(),
  maxCpuMs: z.number().int().nullable(),
  maxMemoryKb: z.number().int().nullable(),
  createdAt: z.date(),
  judgedAt: z.date().nullable(),
  sourceCode: z.string(),
  tests: z.array(SubmissionTestDTOZ)
})

export type HiddenSubmissionTestDTO = z.infer<typeof HiddenSubmissionTestDTOZ>
export type PublicSubmissionTestDTO = z.infer<typeof PublicSubmissionTestDTOZ>
export type SubmissionTestDTO = z.infer<typeof SubmissionTestDTOZ>
export type GetSubmissionOutputDTO = z.infer<typeof GetSubmissionOutputDTOZ>
