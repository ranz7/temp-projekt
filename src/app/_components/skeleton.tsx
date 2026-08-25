import { cn } from './cn'

/** A pulsing placeholder block, shaped by the caller via `className`. Respects reduced motion. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('oj-pulse rounded-md bg-placeholder', className)} />
}
