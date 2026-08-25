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
  wrong_answer: 'Wrong answer',
  time_limit: 'Time limit',
  memory_limit: 'Memory limit',
  runtime_error: 'Runtime error'
}

/** Same accent tokens `StatusBadge` uses for the matching submission status. */
const TEST_VERDICT_ACCENT_CLASSES: Record<TestVerdict, string> = {
  passed: 'bg-status-green/15 text-status-green',
  wrong_answer: 'bg-status-red/15 text-status-red',
  time_limit: 'bg-status-amber/15 text-status-amber',
  memory_limit: 'bg-status-amber/15 text-status-amber',
  runtime_error: 'bg-status-orange/15 text-status-orange'
}

export function testVerdictAccentClass(verdict: TestVerdict): string {
  return TEST_VERDICT_ACCENT_CLASSES[verdict]
}
