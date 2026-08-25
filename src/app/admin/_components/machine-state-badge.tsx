import { cn } from '@/app/_components/cn'
import { MACHINE_STATE_LABELS, type MachineState } from './machine-state'

const COLOR_CLASSES: Record<MachineState, string> = {
  online: 'text-status-green',
  disabled: 'text-status-neutral',
  unreachable: 'text-status-red'
}

/**
 * A filled dot for a working machine, a dashed ring for one turned off on purpose, and
 * a warning triangle for one that should be answering and is not - three different
 * outlines, so the state reads even without colour.
 */
function StateGlyph({ state }: { state: MachineState }) {
  if (state === 'online') {
    return (
      <svg viewBox='0 0 12 12' width='10' height='10' aria-hidden='true'>
        <circle cx='6' cy='6' r='5' fill='currentColor' />
      </svg>
    )
  }

  if (state === 'disabled') {
    return (
      <svg viewBox='0 0 12 12' width='10' height='10' aria-hidden='true'>
        <circle
          cx='6'
          cy='6'
          r='4.5'
          fill='none'
          stroke='currentColor'
          strokeWidth='1.5'
          strokeDasharray='2.3 2.1'
        />
      </svg>
    )
  }

  return (
    <svg viewBox='0 0 12 12' width='11' height='11' aria-hidden='true'>
      <path
        d='M6 0.8 L11.4 10.6 H0.6 Z'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.3'
        strokeLinejoin='round'
      />
      <line x1='6' y1='4.2' x2='6' y2='7' stroke='currentColor' strokeWidth='1.1' />
      <circle cx='6' cy='8.7' r='0.6' fill='currentColor' />
    </svg>
  )
}

/** Machine state, encoded in shape as well as colour so it never depends on colour alone. */
export function MachineStateBadge({ state }: { state: MachineState }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 font-medium text-sm', COLOR_CLASSES[state])}
    >
      <StateGlyph state={state} />
      {MACHINE_STATE_LABELS[state]}
    </span>
  )
}
