import { type Database, db } from '@backend/database/db'
import { askMachineHealth } from '@backend/modules/machine/internal-functions/checker-client'
import { machine__machine_ } from '@backend/modules/machine/schema'
import { loseSubmissionsOfMachine } from '@backend/modules/submission/internal-functions/judging'
import { asc, eq, sql } from 'drizzle-orm'

export type HealthPollReport = {
  /** Machines that answered. */
  reachable: number
  /** Machines that did not. */
  unreachable: number
  /** Submissions taken back from machines that went quiet. */
  requeued: number
  /** Submissions nobody managed to judge within their attempts. */
  failed: number
}

/**
 * Asks every machine how it is doing and writes down the answer.
 *
 * A machine that does not answer is marked unreachable with the reason, and whatever it
 * was judging goes back into the queue for another machine to pick up.
 */
export async function pollMachineHealth(database: Database = db): Promise<HealthPollReport> {
  const report: HealthPollReport = { reachable: 0, unreachable: 0, requeued: 0, failed: 0 }

  const machines = await database
    .select({
      id: machine__machine_.id,
      name: machine__machine_.name_,
      localPort: machine__machine_.local_port_,
      wasReachable: machine__machine_.reachable_
    })
    .from(machine__machine_)
    .orderBy(asc(machine__machine_.name_))

  for (const machine of machines) {
    const outcome = await askMachineHealth(machine)

    if (outcome.reachable) {
      await database
        .update(machine__machine_)
        .set({
          reachable_: true,
          busy_: outcome.health.busy,
          capacity_: outcome.health.capacity,
          problems_: outcome.health.problems,
          version_: outcome.health.version ?? null,
          last_seen_at_: sql`now()`,
          last_error_: null
        })
        .where(eq(machine__machine_.id, machine.id))

      report.reachable += 1

      continue
    }

    await database
      .update(machine__machine_)
      .set({ reachable_: false, busy_: 0, last_error_: outcome.reason })
      .where(eq(machine__machine_.id, machine.id))

    const lost = await loseSubmissionsOfMachine(
      machine.id,
      `${machine.name} stopped answering. The solution is waiting for another machine.`,
      database
    )

    report.unreachable += 1
    report.requeued += lost.requeued
    report.failed += lost.failed
  }

  return report
}
