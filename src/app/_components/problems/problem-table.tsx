'use client'

import type { ProblemListItemDTO } from '@backend/modules/task/endpoints/queries/list-problems/output.dto'
import { useRouter } from 'next/navigation'
import { DataTable } from '@/app/_components/data-table'
import { DifficultyBadge } from './difficulty-badge'

/**
 * The problem list: each row is one problem and opens it.
 *
 * A row cannot be wrapped in a link - a `<tr>` must sit directly under the
 * table - so the row itself navigates on click and on Enter.
 */
export function ProblemTable({ problems }: { problems: ProblemListItemDTO[] }) {
  const router = useRouter()

  return (
    <DataTable>
      <thead>
        <tr>
          <th className='th'>Task</th>
          <th className='th'>Difficulty / kind</th>
          <th className='th'>Tags</th>
          <th className='th'>Solves</th>
        </tr>
      </thead>
      <tbody className='divide-y divide-divider'>
        {problems.map(problem => {
          const href = `/problems/${problem.slug}`

          return (
            <tr
              key={problem.id}
              className='tr cursor-pointer'
              onClick={() => router.push(href)}
              onKeyDown={event => {
                if (event.key === 'Enter') router.push(href)
              }}
              tabIndex={0}
              aria-label={`${problem.code} ${problem.title}`}
            >
              <td className='td'>
                <div className='inline-flex flex-col gap-0.5'>
                  <span className='task-code'>{problem.code}</span>
                  <span className='task-title'>{problem.title}</span>
                </div>
              </td>
              <td className='td'>
                <div className='flex flex-wrap items-center gap-1.5'>
                  <DifficultyBadge difficulty={problem.difficulty} />
                  <span className='tag capitalize'>{problem.kind}</span>
                </div>
              </td>
              <td className='td'>
                <div className='flex flex-wrap gap-1'>
                  {problem.tags.map(tag => (
                    <span key={tag} className='tag'>
                      {tag}
                    </span>
                  ))}
                </div>
              </td>
              <td className='td text-muted tabular-nums'>{problem.solveCount}</td>
            </tr>
          )
        })}
      </tbody>
    </DataTable>
  )
}
