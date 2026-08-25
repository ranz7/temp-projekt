import { z } from 'zod'

export const ContractVersionDTOZ = z.literal(1)

export const CheckerLanguageDTOZ = z.enum(['python', 'cpp'])

export const ClaimJobRequestDTOZ = z.object({
  contractVersion: ContractVersionDTOZ,
  workerId: z.string().min(1),
  languages: z.array(CheckerLanguageDTOZ).min(1)
})

export const PublicJobTestDTOZ = z.object({
  problemTestId: z.uuid(),
  ordinal: z.number().int().positive(),
  visibility: z.literal('public'),
  points: z.number().nonnegative(),
  input: z.string(),
  expectedOutput: z.string()
})

export const HiddenJobTestDTOZ = z.object({
  problemTestId: z.uuid(),
  ordinal: z.number().int().positive(),
  visibility: z.literal('hidden'),
  points: z.number().nonnegative(),
  inputFile: z.string().min(1),
  outputFile: z.string().min(1)
})

export const JobTestDTOZ = z.discriminatedUnion('visibility', [
  PublicJobTestDTOZ,
  HiddenJobTestDTOZ
])

export const ClaimedJobDTOZ = z.object({
  submissionId: z.uuid(),
  claimId: z.uuid(),
  problemSlug: z.string().min(1),
  packageDirectory: z.string().min(1),
  language: CheckerLanguageDTOZ,
  sourceCode: z.string(),
  timeLimitMs: z.number().int().positive(),
  memoryLimitMb: z.number().int().positive(),
  checkerType: z.enum(['token', 'custom']),
  checkerPath: z.string().min(1).nullable(),
  tests: z.array(JobTestDTOZ)
})

export const ClaimJobResponseDTOZ = z.object({
  contractVersion: ContractVersionDTOZ,
  job: ClaimedJobDTOZ.nullable()
})

export const SubmissionClaimDTOZ = z.object({
  contractVersion: ContractVersionDTOZ,
  submissionId: z.uuid(),
  claimId: z.uuid()
})

export const HeartbeatJobRequestDTOZ = SubmissionClaimDTOZ

export const ReleaseJobRequestDTOZ = SubmissionClaimDTOZ.extend({
  reason: z.string().min(1)
})

export const CheckerAcknowledgementDTOZ = z.object({
  contractVersion: ContractVersionDTOZ
})

export type CheckerLanguageDTO = z.infer<typeof CheckerLanguageDTOZ>
export type ClaimJobRequestDTO = z.infer<typeof ClaimJobRequestDTOZ>
export type JobTestDTO = z.infer<typeof JobTestDTOZ>
export type ClaimedJobDTO = z.infer<typeof ClaimedJobDTOZ>
export type ClaimJobResponseDTO = z.infer<typeof ClaimJobResponseDTOZ>
export type SubmissionClaimDTO = z.infer<typeof SubmissionClaimDTOZ>
export type HeartbeatJobRequestDTO = z.infer<typeof HeartbeatJobRequestDTOZ>
export type ReleaseJobRequestDTO = z.infer<typeof ReleaseJobRequestDTOZ>
export type CheckerAcknowledgementDTO = z.infer<typeof CheckerAcknowledgementDTOZ>
