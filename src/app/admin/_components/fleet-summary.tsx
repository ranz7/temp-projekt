import type { MachineRowDTO } from '@backend/modules/machine/endpoints/queries/list-machines/output.dto'
import { Card } from '@/app/_components/card'
import { formatCount } from '../_lib/format'
import { machineState } from './machine-state'

type FleetSummaryProps = {
  machines: MachineRowDTO[]
}

type StatTile = {
  key: string
  label: string
  value: number
  accentClassName: string
}

/** The scan-first read of the fleet: how many are working, down or turned off, before the table. */
export function FleetSummary({ machines }: FleetSummaryProps) {
  const online = machines.filter(machine => machineState(machine) === 'online').length
  const unreachable = machines.filter(machine => machineState(machine) === 'unreachable').length
  const disabled = machines.filter(machine => machineState(machine) === 'disabled').length

  const tiles: StatTile[] = [
    { key: 'online', label: 'Working', value: online, accentClassName: 'text-status-green' },
    { key: 'unreachable', label: 'Down', value: unreachable, accentClassName: 'text-status-red' },
    {
      key: 'disabled',
      label: 'Disabled',
      value: disabled,
      accentClassName: 'text-status-neutral'
    },
    { key: 'total', label: 'Total machines', value: machines.length, accentClassName: '' }
  ]

  return (
    <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
      {tiles.map(tile => (
        <Card key={tile.key} className='flex flex-col gap-1 p-4'>
          <span className='text-muted text-xs uppercase tracking-wide'>{tile.label}</span>
          <span className={`font-semibold text-2xl tabular-nums ${tile.accentClassName}`}>
            {formatCount(tile.value)}
          </span>
        </Card>
      ))}
    </div>
  )
}
