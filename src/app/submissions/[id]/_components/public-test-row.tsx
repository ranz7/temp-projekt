import type { PublicSubmissionTestDTO } from '@backend/modules/submission/endpoints/queries/get-submission/output.dto'
import { TEST_VERDICT_LABELS, testVerdictAccentClass } from '../../_lib/test-verdict'
import { TestMetrics } from './test-metrics'
import { TestOutputBox } from './test-output-box'

type PublicTestRowProps = {
  test: PublicSubmissionTestDTO
}

/** A sample test: everything a person can already see on the problem page is safe to repeat here in full. */
export function PublicTestRow({ test }: PublicTestRowProps) {
  return (
    <div className='card flex flex-col gap-3 p-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='font-medium text-sm'>Sample test {test.ordinal}</p>
        <span className={`badge ${testVerdictAccentClass(test.verdict)}`}>
          {TEST_VERDICT_LABELS[test.verdict]}
        </span>
      </div>
      <TestMetrics
        pointsAwarded={test.pointsAwarded}
        timeMs={test.timeMs}
        memoryKb={test.memoryKb}
        presses={test.presses}
      />
      <div className='grid gap-3 sm:grid-cols-2'>
        <TestOutputBox label='Input' value={test.input} />
        <TestOutputBox label='Expected output' value={test.expectedOutput} />
        <TestOutputBox label='Your output' value={test.actualOutput} />
        {test.message !== null ? <TestOutputBox label='Message' value={test.message} /> : null}
      </div>
    </div>
  )
}
