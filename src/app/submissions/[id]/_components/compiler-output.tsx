type CompilerOutputProps = {
  message: string
}

/** Shown instead of test rows when a solution never made it past compilation. */
export function CompilerOutput({ message }: CompilerOutputProps) {
  return (
    <div className='flex flex-col gap-2 rounded-xl border border-danger/30 bg-danger/10 p-4'>
      <p className='font-medium text-danger text-sm'>Compiler output</p>
      <pre className='max-h-96 w-full overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-card p-3 font-mono text-xs'>
        {message}
      </pre>
    </div>
  )
}
