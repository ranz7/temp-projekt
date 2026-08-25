// Loads the environment before anything reads it - the database module wants it at import.
import '@backend/database/load-env'
import { db } from '@backend/database/db'
import { getSweepSeconds } from '@backend/modules/submission/internal-functions/judging'
import { closeSubmissionQueue } from '@backend/modules/submission/internal-functions/queue'
import { sweepSubmissions } from '@backend/modules/submission/internal-functions/sweeper'

/** `--once` sweeps a single time, for a cron-style deployment or a manual check. */
const runsOnce = process.argv.includes('--once')

let stopping = false

function stop(signal: string): void {
  stopping = true
  console.log(`[sweeper] ${signal} received - finishing the current sweep.`)
}

process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))

function wait(seconds: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, seconds * 1000)
  })
}

async function sweepOnce(): Promise<void> {
  try {
    const report = await sweepSubmissions()

    if (report.requeued + report.failed + report.republished > 0) {
      console.log(
        `[sweeper] requeued ${report.requeued}, failed ${report.failed}, announced ${report.republished}`
      )
    }
  } catch (error) {
    // A sweep that blew up must not take the loop down with it.
    console.error('[sweeper] Sweep failed.', error)
  }
}

async function run(): Promise<void> {
  const sweepSeconds = getSweepSeconds()

  if (!runsOnce) {
    console.log(`[sweeper] Sweeping every ${sweepSeconds}s. Stop with Ctrl+C.`)
  }

  do {
    await sweepOnce()

    if (runsOnce || stopping) break

    await wait(sweepSeconds)
  } while (!stopping)

  closeSubmissionQueue()
  await db.$client?.end()
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})
