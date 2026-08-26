import { cn } from '@/app/_components/cn'

type MachineLampsProps = {
  total: number
  /** How many are working at this point of the run. */
  lit: number
  /** The one that just joined pulses, so the step change is visible. */
  isClimbing: boolean
}

/** Each machine of the run, in the order the run brings them in. */
function lampKeys(total: number): string[] {
  return Array.from({ length: total }, (_, index) => `machine-${index + 1}`)
}

/** The fleet as a row of lamps: one per machine, lit while it is taking work. */
export function MachineLamps({ total, lit, isClimbing }: MachineLampsProps) {
  return (
    <p className='flex flex-wrap items-center gap-1.5'>
      <span className='sr-only'>
        {lit} of {total} machines working
      </span>
      {lampKeys(total).map((key, index) => {
        const isLit = index < lit
        const isNewest = isLit && index === lit - 1

        return (
          <span
            key={key}
            aria-hidden='true'
            className={cn(
              'size-2.5 rounded-full transition-colors duration-500',
              isLit ? 'bg-status-green' : 'bg-placeholder ring-1 ring-border ring-inset',
              isNewest && isClimbing && 'oj-pulse'
            )}
          />
        )
      })}
    </p>
  )
}
