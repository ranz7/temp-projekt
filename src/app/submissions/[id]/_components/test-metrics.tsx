import { formatKilobytes, formatMillis } from '../../_lib/format'

type TestMetricsProps = {
  pointsAwarded: number
  timeMs: number | null
  memoryKb: number | null
  presses: number | null
}

/**
 * The figures every test row shows, sample or hidden. Button presses appear only on an
 * interactive problem, where the grader counted them; an ordinary problem's row reads
 * exactly as it did before, with no empty label left behind.
 */
export function TestMetrics({ pointsAwarded, timeMs, memoryKb, presses }: TestMetricsProps) {
  return (
    <dl className='flex flex-wrap gap-x-6 gap-y-1 text-muted text-xs'>
      <div className='flex gap-1'>
        <dt>Points</dt>
        <dd className='text-foreground'>{pointsAwarded}</dd>
      </div>
      <div className='flex gap-1'>
        <dt>Time</dt>
        <dd className='text-foreground'>{formatMillis(timeMs)}</dd>
      </div>
      <div className='flex gap-1'>
        <dt>Memory</dt>
        <dd className='text-foreground'>{formatKilobytes(memoryKb)}</dd>
      </div>
      {presses !== null ? (
        <div className='flex gap-1'>
          <dt>Button presses</dt>
          <dd className='text-foreground'>{presses}</dd>
        </div>
      ) : null}
    </dl>
  )
}
