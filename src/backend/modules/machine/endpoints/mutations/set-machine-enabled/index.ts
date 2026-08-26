import { machine__machine_ } from '@backend/modules/machine/schema'
import { publicProcedure } from '@backend/trpc'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { SetMachineEnabledInputDTOZ } from './input.dto'
import { SetMachineEnabledOutputDTOZ } from './output.dto'

/**
 * Turns a machine on or off. A machine that is off is given no new work; whatever it is
 * already judging is left to finish.
 */
export const setMachineEnabledProcedure = publicProcedure
  .meta({ operation: 'machine.setMachineEnabled', procedureKind: 'mutation' })
  .input(SetMachineEnabledInputDTOZ)
  .output(SetMachineEnabledOutputDTOZ)
  .mutation(async ({ ctx, input }) => {
    const [machine] = await ctx.db
      .update(machine__machine_)
      .set({ enabled_: input.enabled })
      .where(eq(machine__machine_.id, input.machineId))
      .returning({ id: machine__machine_.id, enabled: machine__machine_.enabled_ })

    if (!machine) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'We could not find that machine.' })
    }

    return machine
  })
