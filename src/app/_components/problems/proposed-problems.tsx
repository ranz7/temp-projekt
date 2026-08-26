import type { ProblemListItemDTO } from '@backend/modules/task/endpoints/queries/list-problems/output.dto'
import Link from 'next/link'
import { Card } from '@/app/_components/card'
import { DifficultyBadge } from './difficulty-badge'

/** A short list of problems to try next, each opening its own page. */
export function ProposedProblems({ problems }: { problems: ProblemListItemDTO[] }) {
  return (
    <Card
      title='Proposed problems'
      subtitle='Tasks to try'
      actionHref='/problems'
      actionLabel='All problems'
    >
      {problems.length === 0 ? (
        <p className='px-4 py-6 text-muted text-sm sm:px-5'>No problems to propose yet.</p>
      ) : (
        <ul className='divide-y divide-divider'>
          {problems.map(problem => (
            <li key={problem.id}>
              <Link
                href={`/problems/${problem.slug}`}
                className='flex items-start justify-between gap-3 px-4 py-3 transition hover:bg-subtle sm:px-5'
              >
                <div className='min-w-0'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className='task-code'>{problem.code}</span>
                    <span className='truncate font-medium text-foreground'>{problem.title}</span>
                  </div>
                  <div className='mt-1 flex flex-wrap gap-1.5'>
                    {problem.tags.map(tag => (
                      <span key={tag} className='tag'>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className='flex shrink-0 flex-col items-end gap-1'>
                  <div className='flex flex-wrap items-center justify-end gap-1'>
                    <DifficultyBadge difficulty={problem.difficulty} />
                    <span className='tag capitalize'>{problem.kind}</span>
                  </div>
                  <span className='muted-meta'>{problem.solveCount} solved</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
