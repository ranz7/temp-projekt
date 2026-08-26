import type { ScalingStepDTO } from '@backend/modules/benchmark/endpoints/queries/get-scaling-run/output.dto'
import { cn } from '@/app/_components/cn'
import { formatRate } from '../_lib/format'

type ScalingChartProps = {
  steps: ScalingStepDTO[]
  /** The rung being measured right now, or null when nothing is running. */
  currentMachineCount: number | null
  /** How many rungs the run will climb to, so the axis is full width from the start. */
  maxMachines: number
}

const HEIGHT = 220
const TOP_PADDING = 16
const LABEL_BAND = 22

/**
 * One bar per machine count: how many solutions a minute the fleet finished with that
 * many machines working. The dashed line is what perfect scaling would look like -
 * one machine's rate multiplied by the machine count - so the gap between the bars and
 * the line is the honest answer to "does another machine actually help".
 */
export function ScalingChart({ steps, currentMachineCount, maxMachines }: ScalingChartProps) {
  const measured = steps.filter(step => step.perMinute !== null)
  const first = measured.find(step => step.machineCount === 1)?.perMinute ?? null
  const perfectTop = first === null ? 0 : first * maxMachines
  const highest = Math.max(...measured.map(step => step.perMinute ?? 0), perfectTop, 1)
  const plotHeight = HEIGHT - TOP_PADDING - LABEL_BAND

  function y(rate: number): number {
    return TOP_PADDING + plotHeight - (rate / highest) * plotHeight
  }

  const rungs = Array.from({ length: maxMachines }, (_, index) => index + 1)
  const columnWidth = 100 / maxMachines

  return (
    <div className='relative w-full'>
      <div className='mb-1 flex items-center justify-between text-[11px] text-meta'>
        <span className='tabular-nums'>peak {formatRate(highest)} / min</span>
        <span className='flex items-center gap-3'>
          <span className='flex items-center gap-1'>
            <span className='h-0.5 w-4 border-status-green border-t-2 border-dashed' />
            if every machine were fully used
          </span>
          <span className='flex items-center gap-1'>
            <span className='size-2 rounded-xs bg-accent' />
            measured
          </span>
        </span>
      </div>
      <svg
        viewBox={`0 0 100 ${HEIGHT}`}
        preserveAspectRatio='none'
        className='h-56 w-full'
        role='img'
        aria-label='Solutions finished per minute against the number of machines working'
      >
        <title>Solutions per minute against machines working</title>

        {/* What perfect scaling would look like. */}
        {first !== null ? (
          <line
            x1={columnWidth / 2}
            y1={y(first)}
            x2={100 - columnWidth / 2}
            y2={y(first * maxMachines)}
            className='text-status-green'
            stroke='currentColor'
            strokeWidth='2'
            strokeDasharray='6 5'
            strokeLinecap='round'
            vectorEffect='non-scaling-stroke'
          />
        ) : null}

        {rungs.map(rung => {
          const step = steps.find(entry => entry.machineCount === rung)
          const isCurrent = rung === currentMachineCount
          const rate = step?.perMinute ?? null
          // A step in flight has no rate yet, so it shows how far through it is instead.
          const progress =
            step === undefined || step.requested === 0 ? 0 : step.finished / step.requested
          const barTop = rate === null ? TOP_PADDING + plotHeight * (1 - progress * 0.25) : y(rate)
          const left = (rung - 1) * columnWidth
          const barWidth = columnWidth * 0.56
          const barLeft = left + (columnWidth - barWidth) / 2

          return (
            <g key={`rung-${rung}`}>
              <rect
                x={barLeft}
                y={TOP_PADDING}
                width={barWidth}
                height={plotHeight}
                className='text-divider'
                fill='currentColor'
                opacity={0.5}
              />
              {step !== undefined ? (
                <rect
                  x={barLeft}
                  y={barTop}
                  width={barWidth}
                  height={Math.max(TOP_PADDING + plotHeight - barTop, 1)}
                  className={cn(
                    'transition-all duration-700',
                    isCurrent ? 'text-status-amber' : 'text-accent'
                  )}
                  fill='currentColor'
                  opacity={rate === null ? 0.55 : 1}
                />
              ) : null}
            </g>
          )
        })}
      </svg>

      {/* Values and axis sit outside the stretched SVG, so text is never distorted. */}
      <div className='-mt-6 grid' style={{ gridTemplateColumns: `repeat(${maxMachines}, 1fr)` }}>
        {rungs.map(rung => {
          const step = steps.find(entry => entry.machineCount === rung)

          return (
            <div key={`axis-${rung}`} className='flex flex-col items-center gap-0.5'>
              <span className='font-medium text-[11px] text-foreground tabular-nums'>
                {step?.perMinute === null || step === undefined ? '' : formatRate(step.perMinute)}
              </span>
              <span
                className={cn(
                  'text-[11px] tabular-nums',
                  rung === currentMachineCount ? 'font-medium text-status-amber' : 'text-meta'
                )}
              >
                {rung}
              </span>
            </div>
          )
        })}
      </div>
      <p className='mt-1 text-center text-[11px] text-meta'>machines working</p>
    </div>
  )
}
