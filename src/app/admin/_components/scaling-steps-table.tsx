import type { ScalingStepDTO } from '@backend/modules/benchmark/endpoints/queries/get-scaling-run/output.dto'
import { cn } from '@/app/_components/cn'
import { DataTable } from '@/app/_components/data-table'
import { formatCount, formatRate } from '../_lib/format'

type ScalingStepsTableProps = {
  steps: ScalingStepDTO[]
  currentMachineCount: number | null
}

const MILLISECONDS_PER_SECOND = 1000

function formatSeconds(wallMs: number): string {
  return `${(wallMs / MILLISECONDS_PER_SECOND).toFixed(1)} s`
}

/** Every rung of the run, with what each extra machine actually bought. */
export function ScalingStepsTable({ steps, currentMachineCount }: ScalingStepsTableProps) {
  const first = steps.find(step => step.machineCount === 1)?.perMinute ?? null

  return (
    <DataTable>
      <thead>
        <tr>
          <th className='th'>Machines</th>
          <th className='th'>Solutions</th>
          <th className='th'>Took</th>
          <th className='th'>Per minute</th>
          <th className='th'>Per machine</th>
          <th className='th'>Slots busy</th>
          <th className='th'>Against one machine</th>
        </tr>
      </thead>
      <tbody className='divide-y divide-divider'>
        {steps.map(step => {
          const isCurrent = step.machineCount === currentMachineCount
          const speedUp = first === null || step.perMinute === null ? null : step.perMinute / first

          return (
            <tr
              key={step.machineCount}
              className={cn('tr tabular-nums', isCurrent && 'bg-tint-amber')}
            >
              <td className='td font-medium'>{step.machineCount}</td>
              <td className='td'>
                {step.isFinished ? (
                  `${formatCount(step.accepted)} accepted`
                ) : (
                  <span className='text-muted'>
                    {formatCount(step.finished)} of {formatCount(step.requested)} judged
                  </span>
                )}
              </td>
              <td className='td'>
                {step.wallMs === null ? (
                  <span className='text-meta'>-</span>
                ) : (
                  formatSeconds(step.wallMs)
                )}
              </td>
              <td className='td font-medium'>
                {step.perMinute === null ? (
                  <span className='text-meta'>-</span>
                ) : (
                  formatRate(step.perMinute)
                )}
              </td>
              <td className='td text-muted'>
                {step.perMinute === null ? '-' : formatRate(step.perMinute / step.machineCount)}
              </td>
              <td className='td text-muted'>
                {step.slotsBusy === null || step.slotsTotal === null ? (
                  '-'
                ) : (
                  <>
                    {formatRate(step.slotsBusy)} of {step.slotsTotal}
                  </>
                )}
              </td>
              <td className='td'>
                {speedUp === null ? (
                  <span className='text-meta'>-</span>
                ) : (
                  <span className='font-medium text-status-green'>x{speedUp.toFixed(2)}</span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </DataTable>
  )
}
