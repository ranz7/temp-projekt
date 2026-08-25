import { type Database, db } from '@backend/database/db'
import { readConfiguredMachines } from '@backend/modules/machine/internal-functions/settings'
import { machine__machine_ } from '@backend/modules/machine/schema'
import { and, eq, notInArray, sql } from 'drizzle-orm'

/** What a machine's page says once the inventory no longer lists it. */
const RETIRED_MESSAGE = 'This machine is no longer listed in CHECKER_MACHINES.'

export type MachineRegistryReport = {
  /** Machines written for the first time. */
  created: number
  /** Machines already known, whose address and port were refreshed. */
  updated: number
  /** Machines the inventory dropped, kept but disabled. */
  retired: number
}

/**
 * Writes `CHECKER_MACHINES` into the registry.
 *
 * A machine already known keeps whatever the operator did to it - a disabled machine
 * stays disabled across restarts - and only its address and port are refreshed. A
 * machine the inventory dropped is disabled rather than deleted, so a submission it
 * once judged still points at something.
 */
export async function syncMachineRegistry(database: Database = db): Promise<MachineRegistryReport> {
  const configured = readConfiguredMachines()

  if (configured === null) return { created: 0, updated: 0, retired: 0 }

  const known = await database.select({ name: machine__machine_.name_ }).from(machine__machine_)
  const knownNames = new Set(known.map(row => row.name))
  const names = configured.map(machine => machine.name)

  if (configured.length > 0) {
    await database
      .insert(machine__machine_)
      .values(
        configured.map(machine => ({
          name_: machine.name,
          address_: machine.address,
          local_port_: machine.localPort
        }))
      )
      .onConflictDoUpdate({
        target: machine__machine_.name_,
        set: {
          address_: sql`excluded.address_`,
          local_port_: sql`excluded.local_port_`
        }
      })
  }

  // Dropped from the inventory: no new work, and honest about not being there.
  const retired = await database
    .update(machine__machine_)
    .set({ enabled_: false, reachable_: false, last_error_: RETIRED_MESSAGE })
    .where(
      names.length === 0
        ? eq(machine__machine_.enabled_, true)
        : and(eq(machine__machine_.enabled_, true), notInArray(machine__machine_.name_, names))
    )
    .returning({ id: machine__machine_.id })

  const created = names.filter(name => !knownNames.has(name)).length

  return { created, updated: names.length - created, retired: retired.length }
}
