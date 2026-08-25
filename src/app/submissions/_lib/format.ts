/** The only two languages a solution may be written in. Kept local so client bundles never pull in `@backend`. */
export type SubmissionLanguageCode = 'python' | 'cpp'

const LANGUAGE_LABELS: Record<SubmissionLanguageCode, string> = {
  python: 'Python',
  cpp: 'C++'
}

const LANGUAGE_EXTENSIONS: Record<SubmissionLanguageCode, string> = {
  python: 'py',
  cpp: 'cpp'
}

/** Readable language name for display, e.g. `cpp` -> `C++`. */
export function formatLanguageLabel(language: SubmissionLanguageCode): string {
  return LANGUAGE_LABELS[language]
}

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC'
})

/**
 * Fixed to UTC and a fixed locale on purpose: the same string must render on
 * the server and after client hydration, whatever timezone either machine is in.
 */
export function formatDateTime(date: Date): string {
  return `${DATE_TIME_FORMATTER.format(date)} UTC`
}

/** "earned out of total", or a plain sentence before a submission has been scored. */
export function formatScore(score: number | null, maxScore: number | null): string {
  if (score === null || maxScore === null) return 'Not scored yet'
  return `${score} / ${maxScore}`
}

export function formatMillis(value: number | null): string {
  return value === null ? '-' : `${value} ms`
}

export function formatKilobytes(value: number | null): string {
  return value === null ? '-' : `${value} KB`
}

/** A readable download name, e.g. `cf-4-a-1b2c3d4e.py`. */
export function submissionSourceFileName(
  problemSlug: string,
  submissionId: string,
  language: SubmissionLanguageCode
): string {
  return `${problemSlug}-${submissionId.slice(0, 8)}.${LANGUAGE_EXTENSIONS[language]}`
}
