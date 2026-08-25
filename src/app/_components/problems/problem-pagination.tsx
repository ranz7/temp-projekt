type ProblemPaginationProps = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

/** "Showing X to Y of N", the current page, and disabled-at-the-ends previous/next controls. */
export function ProblemPagination({ page, pageSize, total, onPageChange }: ProblemPaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const hasPrevious = page > 1
  const hasNext = page * pageSize < total

  return (
    <div className='flex flex-wrap items-center justify-between gap-3 text-sm'>
      <p className='text-muted'>
        Showing {from} to {to} of {total} - page {page}
      </p>
      <div className='flex items-center gap-2'>
        <button
          type='button'
          disabled={!hasPrevious}
          onClick={() => onPageChange(page - 1)}
          className='rounded-lg border border-border px-3 py-1.5 disabled:opacity-40'
        >
          Previous
        </button>
        <button
          type='button'
          disabled={!hasNext}
          onClick={() => onPageChange(page + 1)}
          className='rounded-lg border border-border px-3 py-1.5 disabled:opacity-40'
        >
          Next
        </button>
      </div>
    </div>
  )
}
