import type { ReactNode } from 'react'
import { cn } from './cn'

/**
 * Table wrapper that scrolls horizontally inside its own container on narrow
 * screens instead of overflowing the page. The surrounding panel draws the
 * border, so this only carries the scroll. Pass a normal `<table>` body -
 * `<DataTable><thead>...</thead><tbody>...</tbody></DataTable>`.
 */
export function DataTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className='data-table'>{children}</table>
    </div>
  )
}
