import type { BatchVerdictCountDTO } from '@backend/modules/benchmark/endpoints/queries/get-batch-status/output.dto'
import { StatusBadge } from '@/app/_components/status-badge'
import { formatCount } from '../_lib/format'

type VerdictListProps = {
  verdicts: BatchVerdictCountDTO[]
}

/** Verdicts a batch has produced so far, as they land - one badge and count per status. */
export function VerdictList({ verdicts }: VerdictListProps) {
  if (verdicts.length === 0) {
    return <p className='text-muted text-sm'>No verdict has landed yet.</p>
  }

  return (
    <ul className='flex flex-wrap gap-3'>
      {verdicts.map(verdict => (
        <li key={verdict.status} className='flex items-center gap-2'>
          <StatusBadge status={verdict.status} />
          <span className='tabular-nums text-sm'>{formatCount(verdict.count)}</span>
        </li>
      ))}
    </ul>
  )
}
