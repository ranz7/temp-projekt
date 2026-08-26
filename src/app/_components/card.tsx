import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from './cn'

type CardProps = {
  /** Panel heading. Omit for a bare surface with no header row. */
  title?: string
  subtitle?: string
  actionHref?: string
  actionLabel?: string
  className?: string
  /** Padding and spacing for the body - the panel itself carries none. */
  bodyClassName?: string
  children: ReactNode
}

/**
 * The panel every screen groups content in: a bordered surface, optionally
 * headed by a title, a line of context and a link off to the fuller view.
 */
export function Card({
  title,
  subtitle,
  actionHref,
  actionLabel,
  className,
  bodyClassName,
  children
}: CardProps) {
  return (
    <section className={cn('card', className)}>
      {title !== undefined ? (
        <div className='card-header'>
          <div>
            <h2 className='card-title'>{title}</h2>
            {subtitle !== undefined ? <p className='card-subtitle'>{subtitle}</p> : null}
          </div>
          {actionHref !== undefined && actionLabel !== undefined ? (
            <Link href={actionHref} className='card-action'>
              {actionLabel}
            </Link>
          ) : null}
        </div>
      ) : null}
      {bodyClassName !== undefined ? <div className={bodyClassName}>{children}</div> : children}
    </section>
  )
}
