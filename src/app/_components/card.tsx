import type { ReactNode } from 'react'
import { cn } from './cn'

/** Presentational surface every screen uses for grouped content. */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn('flex flex-col gap-4 rounded-xl border border-border bg-card p-4', className)}
    >
      {children}
    </div>
  )
}
