import type { MachineRowDTO } from '@backend/modules/machine/endpoints/queries/list-machines/output.dto'
import { DataTable } from '@/app/_components/data-table'
import { EmptyState } from '@/app/_components/empty-state'
import { formatCount, formatRelativeToNow } from '../_lib/format'
import { machineState } from './machine-state'
import { MachineStateBadge } from './machine-state-badge'
import { MachineToggle } from './machine-toggle'

type MachineTableProps = {
  machines: MachineRowDTO[]
}

/**
 * Every checking machine, one row each. State is shown as a shape-and-colour badge so a
 * working, a disabled and a down machine are never told apart by colour alone, and a
 * down machine shows the error the server last recorded for it.
 */
export function MachineTable({ machines }: MachineTableProps) {
  if (machines.length === 0) {
    return (
      <EmptyState
        title='No machines are configured yet'
        description='Checker machines register themselves here once the fleet deploy adds them to the inventory file and brings them up.'
      />
    )
  }

  return (
    <DataTable>
      <thead>
        <tr className='border-border border-b text-left text-muted text-xs uppercase tracking-wide'>
          <th className='px-3 py-2 font-medium'>Machine</th>
          <th className='px-3 py-2 font-medium'>State</th>
          <th className='px-3 py-2 font-medium'>Judging now</th>
          <th className='px-3 py-2 font-medium'>Judged total</th>
          <th className='px-3 py-2 font-medium'>Last seen</th>
          <th className='px-3 py-2 font-medium'>
            <span className='sr-only'>Enable or disable</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {machines.map(machine => {
          const state = machineState(machine)

          return (
            <tr key={machine.id} className='border-border border-b align-top last:border-b-0'>
              <td className='px-3 py-2'>
                <div className='flex flex-col gap-0.5'>
                  <span className='font-medium'>{machine.name}</span>
                  <span className='text-muted text-xs'>{machine.address}</span>
                </div>
              </td>
              <td className='px-3 py-2'>
                <div className='flex flex-col gap-0.5'>
                  <MachineStateBadge state={state} />
                  {state === 'unreachable' && machine.lastError !== null ? (
                    <span className='text-status-red text-xs'>{machine.lastError}</span>
                  ) : null}
                </div>
              </td>
              <td className='px-3 py-2 tabular-nums'>{formatCount(machine.judgingNow)}</td>
              <td className='px-3 py-2 tabular-nums'>{formatCount(machine.judgedTotal)}</td>
              <td className='px-3 py-2 text-muted'>{formatRelativeToNow(machine.lastSeenAt)}</td>
              <td className='px-3 py-2'>
                <MachineToggle machineId={machine.id} enabled={machine.enabled} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </DataTable>
  )
}
