import type { ReactNode } from 'react'
import { cn } from './cn'

/**
 * Table wrapper that scrolls horizontally inside its own container on narrow
 * screens instead of overflowing the page. Pass a normal `<table>` as children -
 * `<DataTable><thead>...</thead><tbody>...</tbody></DataTable>`.
 */
export function DataTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('w-full overflow-x-auto rounded-xl border border-border', className)}>
      <table className='w-full min-w-max border-collapse text-sm'>{children}</table>
    </div>
  )
}
