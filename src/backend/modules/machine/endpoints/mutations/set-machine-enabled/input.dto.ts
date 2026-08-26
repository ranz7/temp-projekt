import { z } from 'zod'

export const SetMachineEnabledInputDTOZ = z.object({
  machineId: z.uuid(),
  enabled: z.boolean()
})

export type SetMachineEnabledInputDTO = z.infer<typeof SetMachineEnabledInputDTOZ>
