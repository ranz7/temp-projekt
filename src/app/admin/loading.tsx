import { DataTable } from '@/app/_components/data-table'
import { Skeleton } from '@/app/_components/skeleton'

const SUMMARY_TILE_KEYS = ['tile-1', 'tile-2', 'tile-3', 'tile-4']
const MACHINE_ROW_KEYS = ['row-1', 'row-2', 'row-3', 'row-4']

export default function AdminLoading() {
  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-col gap-2'>
        <Skeleton className='h-8 w-40' />
        <Skeleton className='h-4 w-96 max-w-full' />
      </div>

      <Skeleton className='h-12 w-full' />

      <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
        {SUMMARY_TILE_KEYS.map(key => (
          <div key={key} className='card flex flex-col gap-2 p-4'>
            <Skeleton className='h-3 w-16' />
            <Skeleton className='h-7 w-12' />
          </div>
        ))}
      </div>

      <div className='card flex flex-col gap-3 p-4'>
        <Skeleton className='h-3 w-24' />
        <Skeleton className='h-12 w-full' />
      </div>

      <div className='card flex flex-col gap-3 p-4'>
        <Skeleton className='h-4 w-32' />
        <Skeleton className='h-9 w-full' />
      </div>

      <DataTable>
        <thead>
          <tr>
            <th className='th'>Machine</th>
            <th className='th'>State</th>
            <th className='th'>Judging now</th>
            <th className='th'>Judged total</th>
            <th className='th'>Last seen</th>
            <th className='th'>
              <span className='sr-only'>Enable or disable</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {MACHINE_ROW_KEYS.map(key => (
            <tr key={key} className='tr'>
              <td className='td'>
                <Skeleton className='h-4 w-32' />
              </td>
              <td className='td'>
                <Skeleton className='h-4 w-20' />
              </td>
              <td className='td'>
                <Skeleton className='h-4 w-8' />
              </td>
              <td className='td'>
                <Skeleton className='h-4 w-10' />
              </td>
              <td className='td'>
                <Skeleton className='h-4 w-16' />
              </td>
              <td className='td'>
                <Skeleton className='h-8 w-20' />
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  )
}
