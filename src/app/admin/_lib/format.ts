const SECONDS_PER_MINUTE = 60
const MINUTES_PER_HOUR = 60
const MILLISECONDS_PER_SECOND = 1000

/**
 * How long ago a machine last answered, read at a glance - "just now", "42s ago",
 * "5m ago". Falls back to a full date once it stops being a useful "how fresh is this"
 * signal.
 */
export function formatRelativeToNow(date: Date | null, now: Date = new Date()): string {
  if (date === null) return 'never'

  const elapsedSeconds = Math.max(
    0,
    Math.floor((now.getTime() - date.getTime()) / MILLISECONDS_PER_SECOND)
  )

  if (elapsedSeconds < 5) return 'just now'
  if (elapsedSeconds < SECONDS_PER_MINUTE) return `${elapsedSeconds}s ago`

  const elapsedMinutes = Math.floor(elapsedSeconds / SECONDS_PER_MINUTE)
  if (elapsedMinutes < MINUTES_PER_HOUR) return `${elapsedMinutes}m ago`

  const elapsedHours = Math.floor(elapsedMinutes / MINUTES_PER_HOUR)
  if (elapsedHours < 24) return `${elapsedHours}h ago`

  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Thousands-separated count, e.g. `1284` -> `1,284`. */
export function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}

/** One decimal place, no trailing zero noise - `7` stays `7`, `7.3` stays `7.3`. */
export function formatRate(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

/** The only two languages a solution may be written in. Kept local so client bundles never pull in `@backend`. */
export type SubmissionLanguageCode = 'python' | 'cpp'

const LANGUAGE_LABELS: Record<SubmissionLanguageCode, string> = {
  python: 'Python',
  cpp: 'C++'
}

/** Readable language name for display, e.g. `cpp` -> `C++`. */
export function formatLanguageLabel(language: SubmissionLanguageCode): string {
  return LANGUAGE_LABELS[language]
}
