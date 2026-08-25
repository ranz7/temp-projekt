import { z } from 'zod'

/** The only contract this app and a checker machine both speak. */
export const CHECKER_CONTRACT_VERSION = 2

/** Header every call but `/health` carries. A call without it is refused. */
export const CHECKER_SERVICE_KEY_HEADER = 'x-service-key'

export const CheckerContractVersionDTOZ = z.literal(CHECKER_CONTRACT_VERSION)

export const CheckerLanguageDTOZ = z.enum(['python', 'cpp'])

/** What `GET /health` answers. `problems` names the package directories on its disk. */
export const CheckerHealthDTOZ = z.object({
  contractVersion: CheckerContractVersionDTOZ,
  ok: z.boolean(),
  busy: z.number().int().nonnegative(),
  capacity: z.number().int().nonnegative(),
  problems: z.array(z.string()),
  version: z.string().nullish()
})

/** What `POST /judge` is given. Tests and limits never travel: the machine has them. */
export const CheckerJudgeRequestDTOZ = z.object({
  contractVersion: CheckerContractVersionDTOZ,
  submissionId: z.uuid(),
  problemSlug: z.string().min(1),
  packageDirectory: z.string().min(1),
  language: CheckerLanguageDTOZ,
  sourceCode: z.string()
})

/** What `POST /judge` answers once it has taken the work. */
export const CheckerJudgeAcceptedDTOZ = z.object({
  contractVersion: CheckerContractVersionDTOZ,
  jobId: z.string().min(1)
})

export const CheckerTestVerdictDTOZ = z.enum([
  'passed',
  'wrong_answer',
  'time_limit',
  'memory_limit',
  'runtime_error'
])

export const CheckerFinalStatusDTOZ = z.enum([
  'accepted',
  'wrong_answer',
  'time_limit',
  'memory_limit',
  'runtime_error',
  'compilation_error',
  'internal_error'
])

/**
 * One test the machine ran. It carries no database id: the app matches a row to its
 * own test by `ordinal` within the same `visibility`.
 *
 * The machine also reports `name`, the test file's stem. It is dropped on purpose: a
 * person reading the page counts tests, and a hidden test's file name tells them
 * nothing they can act on.
 */
export const CheckerTestResultDTOZ = z.object({
  ordinal: z.number().int().positive(),
  visibility: z.enum(['public', 'hidden']),
  verdict: CheckerTestVerdictDTOZ,
  passed: z.boolean(),
  pointsAwarded: z.number().nonnegative(),
  message: z.string().nullish(),
  actualOutput: z.string().nullish(),
  timeMs: z.number().int().nonnegative(),
  memoryKb: z.number().int().nonnegative(),
  /**
   * How many button presses an interactive problem's grader counted, which is what the
   * original competition rewarded. Null everywhere else.
   */
  presses: z.number().int().nonnegative().nullish()
})

export const CheckerFinalResultDTOZ = z.object({
  status: CheckerFinalStatusDTOZ,
  score: z.number().nonnegative(),
  maxScore: z.number().nonnegative(),
  compileMessage: z.string().nullish(),
  maxCpuMs: z.number().int().nonnegative(),
  maxMemoryKb: z.number().int().nonnegative(),
  tests: z.array(CheckerTestResultDTOZ)
})

export const CheckerJobRunningDTOZ = z.object({
  contractVersion: CheckerContractVersionDTOZ,
  status: z.literal('running')
})

export const CheckerJobDoneDTOZ = z.object({
  contractVersion: CheckerContractVersionDTOZ,
  status: z.literal('done'),
  result: CheckerFinalResultDTOZ
})

/** What `GET /judge/<jobId>` answers while judging, and once it has finished. */
export const CheckerJobStatusDTOZ = z.discriminatedUnion('status', [
  CheckerJobRunningDTOZ,
  CheckerJobDoneDTOZ
])

export type CheckerLanguageDTO = z.infer<typeof CheckerLanguageDTOZ>
export type CheckerHealthDTO = z.infer<typeof CheckerHealthDTOZ>
export type CheckerJudgeRequestDTO = z.infer<typeof CheckerJudgeRequestDTOZ>
export type CheckerJudgeAcceptedDTO = z.infer<typeof CheckerJudgeAcceptedDTOZ>
export type CheckerTestVerdictDTO = z.infer<typeof CheckerTestVerdictDTOZ>
export type CheckerFinalStatusDTO = z.infer<typeof CheckerFinalStatusDTOZ>
export type CheckerTestResultDTO = z.infer<typeof CheckerTestResultDTOZ>
export type CheckerFinalResultDTO = z.infer<typeof CheckerFinalResultDTOZ>
export type CheckerJobStatusDTO = z.infer<typeof CheckerJobStatusDTOZ>
