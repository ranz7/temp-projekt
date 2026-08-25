type TestOutputBoxProps = {
  label: string
  value: string | null
}

/** A labelled, independently-scrolling box for one piece of test text. Empty input renders as blank, not "null". */
export function TestOutputBox({ label, value }: TestOutputBoxProps) {
  return (
    <div className='flex flex-col gap-1'>
      <p className='text-muted text-xs'>{label}</p>
      <pre className='max-h-48 w-full overflow-auto whitespace-pre rounded-lg border border-border bg-background p-2 font-mono text-xs'>
        {value ?? ''}
      </pre>
    </div>
  )
}
