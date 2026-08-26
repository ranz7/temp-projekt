import { BENCHMARK_SCALING_STATUSES } from '@backend/modules/benchmark/schema'
import { SUBMISSION_LANGUAGES } from '@backend/modules/task/schema'
import { z } from 'zod'

/** One rung: this many machines were working, and this is what they got through. */
export const ScalingStepDTOZ = z.object({
  machineCount: z.number().int(),
  /** Correct solutions the step asked for. */
  requested: z.number().int(),
  /** How many have been created so far - equals `requested` once the step is under way. */
  sent: z.number().int(),
  finished: z.number().int(),
  accepted: z.number().int(),
  /** From the first solution being sent to the last verdict landing. Null until it ends. */
  wallMs: z.number().int().nullable(),
  /** Solutions finished per minute across the whole step. Null until it ends. */
  perMinute: z.number().nullable(),
  /** Judging slots filled on average while the step ran, and how many there were. */
  slotsBusy: z.number().nullable(),
  slotsTotal: z.number().nullable(),
  isFinished: z.boolean()
})

export const ScalingRunDTOZ = z.object({
  id: z.uuid(),
  problemSlug: z.string(),
  problemTitle: z.string(),
  language: z.enum(SUBMISSION_LANGUAGES),
  status: z.enum(BENCHMARK_SCALING_STATUSES),
  submissionsPerStep: z.number().int(),
  maxMachines: z.number().int(),
  startedAt: z.date(),
  endedAt: z.date().nullable(),
  error: z.string().nullable(),
  steps: z.array(ScalingStepDTOZ),
  /** The rung being measured right now, or null between runs. */
  currentMachineCount: z.number().int().nullable()
})

export const GetScalingRunOutputDTOZ = z.object({
  run: ScalingRunDTOZ.nullable()
})

export type ScalingStepDTO = z.infer<typeof ScalingStepDTOZ>
export type ScalingRunDTO = z.infer<typeof ScalingRunDTOZ>
export type GetScalingRunOutputDTO = z.infer<typeof GetScalingRunOutputDTOZ>
