import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  description?: string
  actions?: ReactNode
}

/** Title, optional line of context and optional actions row shared by every screen. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className='flex flex-wrap items-start justify-between gap-4'>
      <div className='space-y-1'>
        <h1 className='font-bold text-2xl text-foreground tracking-tight sm:text-3xl'>{title}</h1>
        {description !== undefined ? <p className='text-muted text-sm'>{description}</p> : null}
      </div>
      {actions !== undefined ? <div className='flex items-center gap-2'>{actions}</div> : null}
    </header>
  )
}
