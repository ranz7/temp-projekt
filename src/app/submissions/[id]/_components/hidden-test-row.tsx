import type { HiddenSubmissionTestDTO } from '@backend/modules/submission/endpoints/queries/get-submission/output.dto'
import { TEST_VERDICT_LABELS, testVerdictAccentClass } from '../../_lib/test-verdict'
import { TestMetrics } from './test-metrics'

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
      <TestMetrics
        pointsAwarded={test.pointsAwarded}
        timeMs={test.timeMs}
        memoryKb={test.memoryKb}
        presses={test.presses}
      />
      <p className='text-muted text-xs italic'>Hidden test data is not shown.</p>
    </div>
  )
}
