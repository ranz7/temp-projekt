import { cn } from './cn'

/** Every state a submission can be in, from enqueue to final verdict. */
export type SubmissionStatus =
  | 'queued'
  | 'running'
  | 'accepted'
  | 'wrong_answer'
  | 'time_limit'
  | 'memory_limit'
  | 'runtime_error'
  | 'compilation_error'
  | 'internal_error'

/** One of the seven accent colours a status can carry - keyed to `--color-status-*`. */
export type StatusAccent = 'neutral' | 'blue' | 'green' | 'red' | 'amber' | 'orange' | 'violet'

/** Readable English label for each status. Reuse this instead of formatting the raw value. */
export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  accepted: 'Accepted',
  wrong_answer: 'Wrong answer',
  time_limit: 'Time limit',
  memory_limit: 'Memory limit',
  runtime_error: 'Runtime error',
  compilation_error: 'Compile error',
  internal_error: 'Internal error'
}

/** Accent colour for each status. Reuse this instead of re-deriving it. */
export const STATUS_ACCENTS: Record<SubmissionStatus, StatusAccent> = {
  queued: 'neutral',
  running: 'blue',
  accepted: 'green',
  wrong_answer: 'red',
  time_limit: 'amber',
  memory_limit: 'amber',
  runtime_error: 'orange',
  compilation_error: 'violet',
  internal_error: 'orange'
}

const ACCENT_CLASSES: Record<StatusAccent, string> = {
  neutral: 'bg-status-neutral/15 text-status-neutral',
  blue: 'bg-status-blue/15 text-status-blue',
  green: 'bg-status-green/15 text-status-green',
  red: 'bg-status-red/15 text-status-red',
  amber: 'bg-status-amber/15 text-status-amber',
  orange: 'bg-status-orange/15 text-status-orange',
  violet: 'bg-status-violet/15 text-status-violet'
}

/** A submission's status badge, pulsing while judging is still going. */
export function StatusBadge({ status }: { status: SubmissionStatus }) {
  const accent = STATUS_ACCENTS[status]
  const isInFlight = status === 'queued' || status === 'running'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-xs',
        ACCENT_CLASSES[accent],
        isInFlight && 'oj-pulse'
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
