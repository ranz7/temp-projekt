import { z } from 'zod'

/** Stopping takes nothing: at most one batch runs, so there is nothing to name. */
export const StopBatchInputDTOZ = z.object({}).optional()

export type StopBatchInputDTO = z.infer<typeof StopBatchInputDTOZ>
