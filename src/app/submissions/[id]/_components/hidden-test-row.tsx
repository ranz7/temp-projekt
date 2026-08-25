import type { HiddenSubmissionTestDTO } from '@backend/modules/submission/endpoints/queries/get-submission/output.dto'
import { formatKilobytes, formatMillis } from '../../_lib/format'
import { TEST_VERDICT_LABELS, testVerdictAccentClass } from '../../_lib/test-verdict'

type HiddenTestRowProps = {
  test: HiddenSubmissionTestDTO
}

/** A hidden test: the server never sends its input, expected output or actual output, so this never implies it has them. */
export function HiddenTestRow({ test }: HiddenTestRowProps) {
  return (
    <div className='flex flex-col gap-2 rounded-xl border border-border bg-card p-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='font-medium text-sm'>Hidden test {test.ordinal}</p>
        <span
          className={`rounded-full px-2.5 py-1 font-medium text-xs ${testVerdictAccentClass(test.verdict)}`}
        >
          {TEST_VERDICT_LABELS[test.verdict]}
        </span>
      </div>
      <dl className='flex flex-wrap gap-x-6 gap-y-1 text-muted text-xs'>
        <div className='flex gap-1'>
          <dt>Points</dt>
          <dd className='text-foreground'>{test.pointsAwarded}</dd>
        </div>
        <div className='flex gap-1'>
          <dt>Time</dt>
          <dd className='text-foreground'>{formatMillis(test.timeMs)}</dd>
        </div>
        <div className='flex gap-1'>
          <dt>Memory</dt>
          <dd className='text-foreground'>{formatKilobytes(test.memoryKb)}</dd>
        </div>
      </dl>
      <p className='text-muted text-xs italic'>Hidden test data is not shown.</p>
    </div>
  )
}
