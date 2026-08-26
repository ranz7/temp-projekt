type ProblemMetaProps = {
  timeLimitMs: number
  memoryLimitMb: number
  ioMode: string
  publicTestCount: number
  hiddenTestCount: number
  solveCount: number
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex justify-between gap-6'>
      <dt>{label}</dt>
      <dd className='font-medium text-foreground tabular-nums'>{value}</dd>
    </div>
  )
}

/**
 * The limits box beside the title: time, memory, I/O mode, test counts and
 * how many people have solved it. The hidden test count is shown here so the
 * number is visible without ever exposing the hidden tests themselves.
 */
export function ProblemMeta({
  timeLimitMs,
  memoryLimitMb,
  ioMode,
  publicTestCount,
  hiddenTestCount,
  solveCount
}: ProblemMetaProps) {
  const totalTests = publicTestCount + hiddenTestCount

  return (
    <dl className='shrink-0 space-y-1 rounded-lg bg-subtle px-3 py-2 text-muted text-xs ring-1 ring-divider'>
      <MetaRow label='Time' value={`${timeLimitMs} ms`} />
      <MetaRow label='Memory' value={`${memoryLimitMb} MB`} />
      <MetaRow label='I/O' value={ioMode} />
      <MetaRow label='Tests' value={`${totalTests} (${hiddenTestCount} hidden)`} />
      <MetaRow label='Solved' value={`${solveCount}`} />
    </dl>
  )
}
