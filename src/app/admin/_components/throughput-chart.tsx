import type { GetThroughputOutputDTO } from '@backend/modules/benchmark/endpoints/queries/get-throughput/output.dto'
import { Card } from '@/app/_components/card'
import { formatCount, formatRate } from '../_lib/format'

type ThroughputChartProps = {
  throughput: GetThroughputOutputDTO
}

const CHART_WIDTH = 320
const CHART_HEIGHT = 48
const BAR_GAP_RATIO = 0.25

/**
 * How fast submissions are finishing, drawn as a number that stays legible while it
 * moves plus a small bar chart of the recent buckets - inline SVG, no charting library.
 */
export function ThroughputChart({ throughput }: ThroughputChartProps) {
  const { buckets, current } = throughput
  const maxRate = Math.max(...buckets.map(bucket => bucket.finishedPerMinute), 1)
  const barWidth = CHART_WIDTH / Math.max(buckets.length, 1)
  const gap = barWidth * BAR_GAP_RATIO

  return (
    <Card className='gap-3 p-4'>
      <span className='text-muted text-xs uppercase tracking-wide'>Throughput</span>
      <div className='flex flex-wrap items-end justify-between gap-4'>
        <div className='flex flex-col gap-1'>
          <span className='font-semibold text-2xl tabular-nums'>
            {formatRate(current.finishedPerMinute)}{' '}
            <span className='font-normal text-muted text-sm'>submissions / min</span>
          </span>
          <span className='text-muted text-xs tabular-nums'>
            {formatCount(current.machinesWorking)} working of {formatCount(current.machinesOnline)}{' '}
            online, {formatCount(current.machinesTotal)} total
          </span>
        </div>

        {buckets.length > 0 ? (
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            width='100%'
            height={CHART_HEIGHT}
            preserveAspectRatio='none'
            className='h-12 min-w-40 max-w-64 flex-1 text-status-blue'
            role='img'
            aria-label={`Recent throughput, up to ${formatRate(maxRate)} submissions per minute`}
          >
            {buckets.map((bucket, index) => {
              const height = (bucket.finishedPerMinute / maxRate) * (CHART_HEIGHT - 2)
              const x = index * barWidth

              return (
                <rect
                  key={bucket.startedAt.getTime()}
                  x={x + gap / 2}
                  y={CHART_HEIGHT - height}
                  width={Math.max(barWidth - gap, 0.5)}
                  height={Math.max(height, 1)}
                  fill='currentColor'
                  opacity={bucket.finishedPerMinute > 0 ? 0.85 : 0.25}
                />
              )
            })}
          </svg>
        ) : null}
      </div>
    </Card>
  )
}
