// Loads the environment before anything reads it - the database module wants it at import.
import '@backend/database/load-env'
import { db } from '@backend/database/db'
import { pollMachineHealth } from '@backend/modules/machine/internal-functions/machine-health'
import { syncMachineRegistry } from '@backend/modules/machine/internal-functions/machine-registry'
import {
  getDispatchSeconds,
  getHealthPollSeconds,
  getResultPollSeconds
} from '@backend/modules/machine/internal-functions/settings'
import { collectSubmissionResults } from '@backend/modules/submission/internal-functions/collector'
import { dispatchQueuedSubmissions } from '@backend/modules/submission/internal-functions/dispatcher'
import { sweepSubmissions } from '@backend/modules/submission/internal-functions/sweeper'

/** `--once` runs a single pass of each loop, for a cron-style deployment or a check. */
const runsOnce = process.argv.includes('--once')

let stopping = false
/** Every loop currently asleep, so a signal wakes all three at once. */
const sleepers = new Set<() => void>()

function stop(signal: string): void {
  stopping = true
  console.log(`[judge] ${signal} received - finishing the current pass.`)

  for (const sleeper of [...sleepers]) sleeper()
}

process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))

/** Waits, but never keeps Ctrl+C waiting with it. */
function wait(seconds: number): Promise<void> {
  return new Promise(resolve => {
    const finish = (): void => {
      clearTimeout(timer)
      sleepers.delete(finish)
      resolve()
    }
    const timer = setTimeout(finish, seconds * 1000)

    sleepers.add(finish)
  })
}

async function loop(name: string, seconds: number, pass: () => Promise<void>): Promise<void> {
  do {
    try {
      await pass()
    } catch (error) {
      // One failed pass must never take the loop down with it.
      console.error(`[judge] The ${name} pass failed.`, error)
    }

    if (runsOnce || stopping) break

    await wait(seconds)
  } while (!stopping)
}

async function healthPass(): Promise<void> {
  const report = await pollMachineHealth()

  if (report.unreachable + report.requeued + report.failed > 0) {
    console.log(
      `[judge] health: ${report.reachable} answering, ${report.unreachable} quiet, ${report.requeued} requeued, ${report.failed} failed`
    )
  }
}

async function dispatchPass(): Promise<void> {
  const swept = await sweepSubmissions()
  const dispatched = await dispatchQueuedSubmissions()

  if (swept.requeued + swept.failed + dispatched.dispatched + dispatched.refused > 0) {
    console.log(
      `[judge] dispatch: ${dispatched.dispatched} sent, ${dispatched.refused} refused, ${dispatched.waiting} waiting, ${swept.requeued} requeued, ${swept.failed} failed`
    )
  }
}

async function collectPass(): Promise<void> {
  const report = await collectSubmissionResults()

  if (report.finished + report.requeued + report.failed > 0) {
    console.log(
      `[judge] results: ${report.finished} finished, ${report.running} running, ${report.requeued} requeued, ${report.failed} failed`
    )
  }
}

async function run(): Promise<void> {
  const registry = await syncMachineRegistry()

  console.log(
    `[judge] machines: ${registry.created} added, ${registry.updated} refreshed, ${registry.retired} retired`
  )

  if (!runsOnce) {
    console.log(
      `[judge] health every ${getHealthPollSeconds()}s, dispatch every ${getDispatchSeconds()}s, results every ${getResultPollSeconds()}s. Stop with Ctrl+C.`
    )
  }

  await Promise.all([
    loop('health', getHealthPollSeconds(), healthPass),
    loop('dispatch', getDispatchSeconds(), dispatchPass),
    loop('result', getResultPollSeconds(), collectPass)
  ])

  await db.$client?.end()
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})
