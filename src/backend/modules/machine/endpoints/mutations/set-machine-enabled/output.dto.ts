import { z } from 'zod'

export const SetMachineEnabledOutputDTOZ = z.strictObject({
  id: z.uuid(),
  enabled: z.boolean()
})

export type SetMachineEnabledOutputDTO = z.infer<typeof SetMachineEnabledOutputDTOZ>
