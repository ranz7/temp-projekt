import type { PublicSubmissionTestDTO } from '@backend/modules/submission/endpoints/queries/get-submission/output.dto'
import { formatKilobytes, formatMillis } from '../../_lib/format'
import { TEST_VERDICT_LABELS, testVerdictAccentClass } from '../../_lib/test-verdict'
import { TestOutputBox } from './test-output-box'

type PublicTestRowProps = {
  test: PublicSubmissionTestDTO
}

/** A sample test: everything a person can already see on the problem page is safe to repeat here in full. */
export function PublicTestRow({ test }: PublicTestRowProps) {
  return (
    <div className='flex flex-col gap-3 rounded-xl border border-border bg-card p-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='font-medium text-sm'>Sample test {test.ordinal}</p>
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
      <div className='grid gap-3 sm:grid-cols-2'>
        <TestOutputBox label='Input' value={test.input} />
        <TestOutputBox label='Expected output' value={test.expectedOutput} />
        <TestOutputBox label='Your output' value={test.actualOutput} />
        {test.message !== null ? <TestOutputBox label='Message' value={test.message} /> : null}
      </div>
    </div>
  )
}
