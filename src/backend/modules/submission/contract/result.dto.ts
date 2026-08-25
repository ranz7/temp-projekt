import { z } from 'zod'
import { ContractVersionDTOZ } from './job.dto'

export const TestVerdictDTOZ = z.enum([
  'passed',
  'wrong_answer',
  'time_limit',
  'memory_limit',
  'runtime_error'
])

export const FinalSubmissionStatusDTOZ = z.enum([
  'accepted',
  'wrong_answer',
  'time_limit',
  'memory_limit',
  'runtime_error',
  'compilation_error',
  'internal_error'
])

export const TestResultDTOZ = z.object({
  problemTestId: z.uuid(),
  ordinal: z.number().int().positive(),
  verdict: TestVerdictDTOZ,
  passed: z.boolean(),
  pointsAwarded: z.number().nonnegative(),
  message: z.string().nullable(),
  actualOutput: z.string().nullable(),
  timeMs: z.number().int().nonnegative(),
  memoryKb: z.number().int().nonnegative()
})

const ResultClaimDTOZ = z.object({
  contractVersion: ContractVersionDTOZ,
  submissionId: z.uuid(),
  claimId: z.uuid()
})

export const RunningResultRequestDTOZ = ResultClaimDTOZ.extend({
  status: z.literal('running')
})

export const FinalResultRequestDTOZ = ResultClaimDTOZ.extend({
  status: FinalSubmissionStatusDTOZ,
  score: z.number().nonnegative(),
  maxScore: z.number().nonnegative(),
  compileMessage: z.string().nullable(),
  maxCpuMs: z.number().int().nonnegative(),
  maxMemoryKb: z.number().int().nonnegative(),
  tests: z.array(TestResultDTOZ)
})

export const ResultRequestDTOZ = z.union([RunningResultRequestDTOZ, FinalResultRequestDTOZ])

export type TestVerdictDTO = z.infer<typeof TestVerdictDTOZ>
export type FinalSubmissionStatusDTO = z.infer<typeof FinalSubmissionStatusDTOZ>
export type TestResultDTO = z.infer<typeof TestResultDTOZ>
export type RunningResultRequestDTO = z.infer<typeof RunningResultRequestDTOZ>
export type FinalResultRequestDTO = z.infer<typeof FinalResultRequestDTOZ>
export type ResultRequestDTO = z.infer<typeof ResultRequestDTOZ>
