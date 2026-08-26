import { DataTable } from '../_components/data-table'
import { Skeleton } from '../_components/skeleton'

const SKELETON_ROWS = [0, 1, 2, 3, 4, 5, 6, 7] as const

export default function RankingLoading() {
  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-col gap-2'>
        <Skeleton className='h-8 w-28' />
        <Skeleton className='h-4 w-96 max-w-full' />
      </div>
      <DataTable>
        <thead>
          <tr>
            <th className='px-4 py-3 font-medium'>Rank</th>
            <th className='px-4 py-3 font-medium'>Person</th>
            <th className='px-4 py-3 font-medium'>Problems solved</th>
          </tr>
        </thead>
        <tbody>
          {SKELETON_ROWS.map(row => (
            <tr key={row} className='tr'>
              <td className='px-4 py-3'>
                <Skeleton className='h-4 w-6' />
              </td>
              <td className='px-4 py-3'>
                <Skeleton className='h-4 w-36' />
              </td>
              <td className='px-4 py-3'>
                <Skeleton className='h-4 w-10' />
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  )
}
