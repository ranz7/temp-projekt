import 'katex/dist/katex.css'

import type { GetProblemOutputDTO } from '@backend/modules/task/endpoints/queries/get-problem/output.dto'
import Link from 'next/link'
import { DifficultyBadge } from './difficulty-badge'
import { LANGUAGE_LABELS } from './language'
import { ProblemMeta } from './problem-meta'
import { ProblemSamples } from './problem-samples'
import { StatementMarkdown } from './statement-markdown'

function StatementSection({ title, text }: { title: string; text: string | null }) {
  if (text === null || text.length === 0) {
    return null
  }

  return (
    <section>
      <h2 className='statement-h'>{title}</h2>
      <StatementMarkdown text={text} className='statement-p' />
    </section>
  )
}

/** The problem itself: what it is, what it costs, and every public sample. */
export function ProblemStatement({ problem }: { problem: GetProblemOutputDTO }) {
  const hasMarkdown = problem.statementMarkdown !== null && problem.statementMarkdown.length > 0

  return (
    <article className='card'>
      <div className='border-divider border-b px-4 py-4 sm:px-5'>
        <div className='mb-2 flex flex-wrap items-center gap-2 text-sm'>
          <Link href='/problems' className='text-accent hover:text-accent-hover'>
            ← Problems
          </Link>
          <span className='text-meta'>/</span>
          <span className='task-code'>{problem.code}</span>
        </div>

        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='min-w-0 space-y-2'>
            <h1 className='font-bold text-foreground text-xl tracking-tight sm:text-2xl'>
              <span className='mr-2 font-mono text-accent'>{problem.code}</span>
              {problem.title}
            </h1>
            <div className='flex flex-wrap items-center gap-2'>
              <DifficultyBadge difficulty={problem.difficulty} />
              <span className='tag capitalize'>{problem.kind}</span>
              {problem.rating !== null ? (
                <span className='tag tabular-nums'>★ {problem.rating}</span>
              ) : null}
              {problem.tags.map(tag => (
                <span key={tag} className='tag'>
                  {tag}
                </span>
              ))}
            </div>
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
      </div>

      <div className='space-y-6 px-4 py-5 sm:px-5'>
        {hasMarkdown ? (
          <StatementMarkdown text={problem.statementMarkdown ?? ''} className='statement-p' />
        ) : (
          <>
            <StatementSection title='Statement' text={problem.statement} />
            <StatementSection title='Input' text={problem.statementInput} />
            <StatementSection title='Output' text={problem.statementOutput} />
            <StatementSection title='Notes' text={problem.statementNotes} />
          </>
        )}

        <section>
          <h2 className='statement-h'>Allowed languages</h2>
          <p className='statement-p'>
            {problem.languages.map(language => LANGUAGE_LABELS[language]).join(', ')}
          </p>
        </section>

        <section className='space-y-4'>
          <h2 className='statement-h'>Samples</h2>
          <ProblemSamples samples={problem.samples} />
        </section>
      </div>
    </article>
  )
}
