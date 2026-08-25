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
    <div className='flex items-center justify-between gap-4'>
      <dt className='text-muted'>{label}</dt>
      <dd className='font-medium tabular-nums'>{value}</dd>
    </div>
  )
}

/**
 * Compact stat grid: time, memory, I/O mode, test counts and solve count.
 * Hidden test count is shown here so the number is visible without ever
 * exposing the hidden tests themselves.
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
    <dl className='flex flex-col gap-1.5 rounded-lg border border-border bg-background px-3 py-2.5 text-sm'>
      <MetaRow label='Time limit' value={`${timeLimitMs} ms`} />
      <MetaRow label='Memory limit' value={`${memoryLimitMb} MB`} />
      <MetaRow label='I/O' value={ioMode} />
      <MetaRow label='Tests' value={`${totalTests} (${hiddenTestCount} hidden)`} />
      <MetaRow label='Solved by' value={`${solveCount}`} />
    </dl>
  )
}
