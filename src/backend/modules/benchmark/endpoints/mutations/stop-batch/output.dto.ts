import { z } from 'zod'

export const StopBatchOutputDTOZ = z.strictObject({
  /** False when nothing was running, which is not an error. */
  stopped: z.boolean(),
  id: z.uuid().nullable(),
  /** How many submissions the batch managed to send. They are all still judged. */
  createdCount: z.number().int().nonnegative()
})

export type StopBatchOutputDTO = z.infer<typeof StopBatchOutputDTOZ>
