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
  wrong_answer: 'Wrong Answer',
  time_limit: 'Time Limit',
  memory_limit: 'Memory Limit',
  runtime_error: 'Runtime Error',
  compilation_error: 'Compile Error',
  internal_error: 'Internal Error'
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
  neutral: 'bg-tint-neutral text-tint-neutral-ink ring-tint-neutral-ring',
  blue: 'bg-tint-blue text-tint-blue-ink ring-tint-blue-ring',
  green: 'bg-tint-green text-tint-green-ink ring-tint-green-ring',
  red: 'bg-tint-red text-tint-red-ink ring-tint-red-ring',
  amber: 'bg-tint-amber text-tint-amber-ink ring-tint-amber-ring',
  orange: 'bg-tint-orange text-tint-orange-ink ring-tint-orange-ring',
  violet: 'bg-tint-violet text-tint-violet-ink ring-tint-violet-ring'
}

/** A submission's status badge, pulsing while judging is still going. */
export function StatusBadge({ status }: { status: SubmissionStatus }) {
  const accent = STATUS_ACCENTS[status]
  const isInFlight = status === 'queued' || status === 'running'

  return (
    <span className={cn('badge', ACCENT_CLASSES[accent], isInFlight && 'oj-pulse')}>
      {STATUS_LABELS[status]}
    </span>
  )
}
