import type { ProblemListItemDTO } from '@backend/modules/task/endpoints/queries/list-problems/output.dto'
import Link from 'next/link'
import { DataTable } from '@/app/_components/data-table'
import { DifficultyBadge } from './difficulty-badge'

/** The problem list table: code, title, difficulty, tags, kind and solve count. */
export function ProblemTable({ problems }: { problems: ProblemListItemDTO[] }) {
  return (
    <DataTable>
      <thead>
        <tr className='border-border border-b text-left text-muted text-xs'>
          <th className='px-3 py-2 font-medium'>Code</th>
          <th className='px-3 py-2 font-medium'>Title</th>
          <th className='px-3 py-2 font-medium'>Difficulty</th>
          <th className='px-3 py-2 font-medium'>Tags</th>
          <th className='px-3 py-2 font-medium'>Kind</th>
          <th className='px-3 py-2 text-right font-medium'>Solves</th>
        </tr>
      </thead>
      <tbody>
        {problems.map(problem => (
          <tr key={problem.id} className='border-border border-b last:border-0'>
            <td className='px-3 py-2 font-mono text-xs text-muted'>{problem.code}</td>
            <td className='px-3 py-2'>
              {/* One link per row, not one per cell - a second <Link> to the same
                  href doubles that route's prefetch traffic for no benefit. */}
              <Link href={`/problems/${problem.slug}`} className='text-accent hover:underline'>
                {problem.title}
              </Link>
            </td>
            <td className='px-3 py-2'>
              <DifficultyBadge difficulty={problem.difficulty} />
            </td>
            <td className='px-3 py-2'>
              <div className='flex flex-wrap gap-1'>
                {problem.tags.length === 0 ? (
                  <span className='text-muted text-xs'>-</span>
                ) : (
                  problem.tags.map(tag => (
                    <span key={tag} className='rounded-full bg-placeholder px-2 py-0.5 text-xs'>
                      {tag}
                    </span>
                  ))
                )}
              </div>
            </td>
            <td className='px-3 py-2 text-muted text-xs'>{problem.kind}</td>
            <td className='px-3 py-2 text-right'>{problem.solveCount}</td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  )
}
