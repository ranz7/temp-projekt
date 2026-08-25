import type { MachineRowDTO } from '@backend/modules/machine/endpoints/queries/list-machines/output.dto'

/**
 * The three states a machine is put in on the panel. `disabled` wins over
 * `unreachable`: the operator turned it off on purpose, so that is the state worth
 * leading with even if it also happens to be down.
 */
export type MachineState = 'online' | 'disabled' | 'unreachable'

export function machineState(machine: Pick<MachineRowDTO, 'enabled' | 'reachable'>): MachineState {
  if (!machine.enabled) return 'disabled'
  if (!machine.reachable) return 'unreachable'
  return 'online'
}

export const MACHINE_STATE_LABELS: Record<MachineState, string> = {
  online: 'Online',
  disabled: 'Disabled',
  unreachable: 'Unreachable'
}
