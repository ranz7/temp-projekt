import { readPositiveInteger } from '@backend/modules/machine/internal-functions/settings'

/** How far apart two batch submissions are created, so the queue fills steadily. */
const DEFAULT_SUBMISSION_INTERVAL_MS = 100

/** How wide one point on the throughput line is. */
export const THROUGHPUT_BUCKET_SECONDS = 15

/** How far back the throughput line reaches by default. */
export const THROUGHPUT_DEFAULT_WINDOW_MINUTES = 15

/** The longest window the panel may ask for. */
export const THROUGHPUT_MAX_WINDOW_MINUTES = 180

/**
 * The gap between two submissions of a running batch. A batch is a load test, so it
 * arrives as a stream rather than as one spike; zero is allowed and used by tests.
 */
export function getBenchmarkSubmissionIntervalMs(): number {
  const raw = process.env.BENCHMARK_SUBMISSION_INTERVAL_MS

  if (raw !== undefined && raw.trim() === '0') return 0

  return readPositiveInteger('BENCHMARK_SUBMISSION_INTERVAL_MS', DEFAULT_SUBMISSION_INTERVAL_MS)
}
