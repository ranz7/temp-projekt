/**
 * Outcome of one test run. Kept as a local literal union - the backend's
 * `TEST_VERDICTS` list lives behind a `drizzle-orm` import that must never
 * reach a client bundle.
 */
export type TestVerdict =
  | 'passed'
  | 'wrong_answer'
  | 'time_limit'
  | 'memory_limit'
  | 'runtime_error'

export const TEST_VERDICT_LABELS: Record<TestVerdict, string> = {
  passed: 'Passed',
  wrong_answer: 'Wrong Answer',
  time_limit: 'Time Limit',
  memory_limit: 'Memory Limit',
  runtime_error: 'Runtime Error'
}

/** Same accent tokens `StatusBadge` uses for the matching submission status. */
const TEST_VERDICT_ACCENT_CLASSES: Record<TestVerdict, string> = {
  passed: 'bg-tint-green text-tint-green-ink ring-tint-green-ring',
  wrong_answer: 'bg-tint-red text-tint-red-ink ring-tint-red-ring',
  time_limit: 'bg-tint-amber text-tint-amber-ink ring-tint-amber-ring',
  memory_limit: 'bg-tint-amber text-tint-amber-ink ring-tint-amber-ring',
  runtime_error: 'bg-tint-orange text-tint-orange-ink ring-tint-orange-ring'
}

export function testVerdictAccentClass(verdict: TestVerdict): string {
  return TEST_VERDICT_ACCENT_CLASSES[verdict]
}
