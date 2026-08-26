import { z } from 'zod'

export const StopScalingRunOutputDTOZ = z.object({
  /** False when nothing was running, so the panel can say so instead of pretending. */
  stopped: z.boolean()
})

export type StopScalingRunOutputDTO = z.infer<typeof StopScalingRunOutputDTOZ>
