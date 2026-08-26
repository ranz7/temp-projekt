import { z } from 'zod'

/** Everything the panel shows about one checking machine. */
export const MachineRowDTOZ = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  address: z.string(),
  /** The port on the application machine whose SSH tunnel ends at this checker. */
  localPort: z.number().int().positive(),
  enabled: z.boolean(),
  reachable: z.boolean(),
  capacity: z.number().int().nonnegative(),
  /** How busy the machine last said it was. */
  busy: z.number().int().nonnegative(),
  /** How many submissions this app has given it and not yet collected. */
  judgingNow: z.number().int().nonnegative(),
  judgedTotal: z.number().int().nonnegative(),
  version: z.string().nullable(),
  /** The package directories this machine has on its disk. */
  problems: z.array(z.string()),
  lastSeenAt: z.date().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.date()
})

export const ListMachinesOutputDTOZ = z.strictObject({
  machines: z.array(MachineRowDTOZ)
})

export type MachineRowDTO = z.infer<typeof MachineRowDTOZ>
export type ListMachinesOutputDTO = z.infer<typeof ListMachinesOutputDTOZ>
