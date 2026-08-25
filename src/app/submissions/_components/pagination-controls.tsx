import Link from 'next/link'
import { cn } from '@/app/_components/cn'

type PaginationControlsProps = {
  page: number
  pageSize: number
  total: number
  basePath: string
}

const PAGE_LINK_CLASSES = 'rounded-lg border border-border px-3 py-1.5 font-medium text-sm'

/** Previous/next paging shared by both submission lists. Postgres already did the paging - this just links between pages. */
export function PaginationControls({ page, pageSize, total, basePath }: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const hasPrevious = page > 1
  const hasNext = page < totalPages

  return (
    <div className='flex items-center justify-between gap-4 text-sm'>
      <p className='text-muted'>
        Page {page} of {totalPages}
      </p>
      <div className='flex items-center gap-2'>
        {hasPrevious ? (
          <Link
            href={`${basePath}?page=${page - 1}`}
            className={cn(PAGE_LINK_CLASSES, 'hover:bg-placeholder')}
          >
            Previous
          </Link>
        ) : (
          <span className={cn(PAGE_LINK_CLASSES, 'text-muted opacity-50')}>Previous</span>
        )}
        {hasNext ? (
          <Link
            href={`${basePath}?page=${page + 1}`}
            className={cn(PAGE_LINK_CLASSES, 'hover:bg-placeholder')}
          >
            Next
          </Link>
        ) : (
          <span className={cn(PAGE_LINK_CLASSES, 'text-muted opacity-50')}>Next</span>
        )}
      </div>
    </div>
  )
}
