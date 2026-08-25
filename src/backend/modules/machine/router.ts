import { createTRPCRouter } from '@backend/trpc'
import { setMachineEnabledProcedure } from './endpoints/mutations/set-machine-enabled'
import { listMachinesProcedure } from './endpoints/queries/list-machines'

export const machineRouter = createTRPCRouter({
  listMachines: listMachinesProcedure,
  setMachineEnabled: setMachineEnabledProcedure
})
