type ErrorStateProps = {
  title?: string
  description: string
}

/** Shared readable failure copy for query and route errors. Never a stack trace. */
export function ErrorState({ title = 'Something went wrong', description }: ErrorStateProps) {
  return (
    <div className='flex flex-col gap-1 rounded-xl border border-danger/30 bg-danger/10 p-4'>
      <p className='font-medium text-danger'>{title}</p>
      <p className='text-sm'>{description}</p>
    </div>
  )
}
