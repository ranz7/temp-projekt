import 'katex/dist/katex.css'

import type { GetProblemOutputDTO } from '@backend/modules/task/endpoints/queries/get-problem/output.dto'
import { Card } from '@/app/_components/card'
import { DifficultyBadge } from './difficulty-badge'
import { MathText } from './math-text'
import { ProblemMeta } from './problem-meta'
import { ProblemSamples } from './problem-samples'

function StatementSection({ title, text }: { title: string; text: string | null }) {
  if (text === null || text.length === 0) {
    return null
  }

  return (
    <section className='flex flex-col gap-2'>
      <h2 className='font-semibold text-sm'>{title}</h2>
      <MathText text={text} className='text-sm leading-relaxed' />
    </section>
  )
}

/** Left column: code, title, tags, limits and the full statement with samples. */
export function ProblemStatement({ problem }: { problem: GetProblemOutputDTO }) {
  return (
    <Card className='gap-6'>
      <div className='flex flex-col gap-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='font-mono text-accent text-sm'>{problem.code}</span>
          <h1 className='font-semibold text-2xl tracking-tight'>{problem.title}</h1>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <DifficultyBadge difficulty={problem.difficulty} />
          {problem.rating !== null ? (
            <span className='rounded-full bg-placeholder px-2.5 py-1 text-xs tabular-nums'>
              ★ {problem.rating}
            </span>
          ) : null}
          {problem.tags.map(tag => (
            <span key={tag} className='rounded-full bg-placeholder px-2.5 py-1 text-xs'>
              {tag}
            </span>
          ))}
        </div>
        <ProblemMeta
          timeLimitMs={problem.timeLimitMs}
          memoryLimitMb={problem.memoryLimitMb}
          ioMode={problem.ioMode}
          publicTestCount={problem.samples.length}
          hiddenTestCount={problem.hiddenTestCount}
          solveCount={problem.solveCount}
        />
      </div>

      <StatementSection title='Statement' text={problem.statement} />
      <StatementSection title='Input' text={problem.statementInput} />
      <StatementSection title='Output' text={problem.statementOutput} />
      <StatementSection title='Notes' text={problem.statementNotes} />

      <section className='flex flex-col gap-3'>
        <h2 className='font-semibold text-sm'>Samples</h2>
        <ProblemSamples samples={problem.samples} />
      </section>
    </Card>
  )
}
