import type { SubmissionTestDTO } from '@backend/modules/submission/endpoints/queries/get-submission/output.dto'
import { HiddenTestRow } from './hidden-test-row'
import { PublicTestRow } from './public-test-row'

type TestResultsProps = {
  tests: SubmissionTestDTO[]
}

/** Samples first, then hidden tests, each numbered within its own block - matches how the endpoint orders them. */
export function TestResults({ tests }: TestResultsProps) {
  return (
    <div className='flex flex-col gap-3'>
      <h2 className='font-medium text-sm'>Tests</h2>
      {tests.map(test =>
        test.visibility === 'public' ? (
          <PublicTestRow key={`public-${test.ordinal}`} test={test} />
        ) : (
          <HiddenTestRow key={`hidden-${test.ordinal}`} test={test} />
        )
      )}
    </div>
  )
}
