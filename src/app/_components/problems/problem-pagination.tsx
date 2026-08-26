type ProblemPaginationProps = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  disabled?: boolean
}

/** The list footer: step a page back or forward, greyed out at either end. */
export function ProblemPagination({
  page,
  pageSize,
  total,
  onPageChange,
  disabled = false
}: ProblemPaginationProps) {
  const hasPrevious = page > 1
  const hasNext = page * pageSize < total

  return (
    <div className='flex flex-wrap items-center justify-between gap-3 border-divider border-t px-4 py-3 sm:px-5'>
      <button
        type='button'
        disabled={!hasPrevious || disabled}
        onClick={() => onPageChange(page - 1)}
        className='btn-secondary'
      >
        Previous
      </button>
      <button
        type='button'
        disabled={!hasNext || disabled}
        onClick={() => onPageChange(page + 1)}
        className='btn-secondary'
      >
        Next
      </button>
    </div>
  )
}
