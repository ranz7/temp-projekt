import type { ProblemSampleDTO } from '@backend/modules/task/endpoints/queries/get-problem/output.dto'
import { StatementMarkdown } from './statement-markdown'

function SampleBlock({ sample, index }: { sample: ProblemSampleDTO; index: number }) {
  // An interactive problem has no expected output: the grader answers back
  // instead of a file being compared, so the sample is the input alone.
  const hasOutput = sample.expectedOutput !== null && sample.expectedOutput.length > 0

  return (
    <div className='sample-block'>
      <p className='mb-2 font-semibold text-muted text-xs uppercase tracking-wide'>
        Sample {index + 1}
      </p>
      <div className={hasOutput ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-3'}>
        <div>
          <p className='mb-1 font-medium text-muted text-xs'>Input</p>
          <pre className='sample-pre'>{sample.input}</pre>
        </div>
        {hasOutput ? (
          <div>
            <p className='mb-1 font-medium text-muted text-xs'>Output</p>
            <pre className='sample-pre'>{sample.expectedOutput}</pre>
          </div>
        ) : null}
      </div>
      {sample.explanation !== null ? (
        <StatementMarkdown text={sample.explanation} className='mt-2 text-muted text-sm' />
      ) : null}
    </div>
  )
}

/**
 * Every public sample and nothing else - hidden tests never reach this
 * component because the endpoint never returns them.
 */
export function ProblemSamples({ samples }: { samples: ProblemSampleDTO[] }) {
  if (samples.length === 0) {
    return <p className='text-muted text-sm'>No public samples.</p>
  }

  return (
    <div className='space-y-4'>
      {samples.map((sample, index) => (
        <SampleBlock key={sample.ordinal} sample={sample} index={index} />
      ))}
    </div>
  )
}
