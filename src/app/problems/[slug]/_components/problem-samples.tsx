import type { ProblemSampleDTO } from '@backend/modules/task/endpoints/queries/get-problem/output.dto'
import { EmptyState } from '@/app/_components/empty-state'
import { StatementMarkdown } from './statement-markdown'

function SampleBlock({ sample, index }: { sample: ProblemSampleDTO; index: number }) {
  return (
    <div className='flex flex-col gap-2 rounded-lg border border-border p-3'>
      <p className='font-medium text-xs uppercase tracking-wide'>Sample {index + 1}</p>
      <div className='grid gap-3 sm:grid-cols-2'>
        <div className='flex flex-col gap-1'>
          <p className='text-muted text-xs'>Input</p>
          <pre className='overflow-x-auto rounded-md bg-background p-2 text-xs'>{sample.input}</pre>
        </div>
        <div className='flex flex-col gap-1'>
          <p className='text-muted text-xs'>Expected output</p>
          <pre className='overflow-x-auto rounded-md bg-background p-2 text-xs'>
            {sample.expectedOutput}
          </pre>
        </div>
      </div>
      {sample.explanation !== null ? (
        <StatementMarkdown text={sample.explanation} className='text-muted' />
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
    return <EmptyState title='No public samples' description='This problem ships no sample test.' />
  }

  return (
    <div className='flex flex-col gap-3'>
      {samples.map((sample, index) => (
        <SampleBlock key={sample.ordinal} sample={sample} index={index} />
      ))}
    </div>
  )
}
