import type { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  description?: string
  action?: ReactNode
}

/** Shared "nothing here" placeholder for lists with no rows. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className='flex flex-col items-center gap-2 rounded-xl border border-border border-dashed p-8 text-center'>
      <p className='font-medium'>{title}</p>
      {description !== undefined ? <p className='text-muted text-sm'>{description}</p> : null}
      {action}
    </div>
  )
}
