import { db } from '@backend/database/db'
import { FLEET_PREFIX } from '@backend/modules/machine/__tests__/fleet-fixture'
import { syncMachineRegistry } from '@backend/modules/machine/internal-functions/machine-registry'
import { machine__machine_ } from '@backend/modules/machine/schema'
import { asc, eq, sql } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

const FIRST = `${FLEET_PREFIX}boot-01`
const SECOND = `${FLEET_PREFIX}boot-02`

function inventory(machines: Array<{ name: string; address: string; localPort: number }>): void {
  process.env.CHECKER_MACHINES = JSON.stringify(machines)
}

async function readMachines() {
  return db.select().from(machine__machine_).orderBy(asc(machine__machine_.name_))
}

async function clearMachines(): Promise<void> {
  // The sync looks at every machine, so this file needs the table to itself.
  await db.delete(machine__machine_).where(sql`true`)
}

beforeAll(clearMachines)

afterEach(async () => {
  process.env.CHECKER_MACHINES = ''
  await clearMachines()
})

afterAll(clearMachines)

describe('syncMachineRegistry', () => {
  it('writes the machines the deployment lists', async () => {
    inventory([
      { name: FIRST, address: '16.171.242.233', localPort: 9001 },
      { name: SECOND, address: '16.171.242.234', localPort: 9002 }
    ])

    const report = await syncMachineRegistry()

    expect(report.created).toBe(2)

    const machines = await readMachines()

    expect(machines.map(machine => machine.name_)).toEqual([FIRST, SECOND])
    expect(machines[0].address_).toBe('16.171.242.233')
    expect(machines[0].local_port_).toBe(9001)
    expect(machines[0].enabled_).toBe(true)
    expect(machines[0].reachable_).toBe(false)
  })

  it('refreshes an address and a port instead of adding the machine twice', async () => {
    inventory([{ name: FIRST, address: '16.171.242.233', localPort: 9001 }])
    await syncMachineRegistry()

    inventory([{ name: FIRST, address: '10.20.30.40', localPort: 9100 }])
    const second = await syncMachineRegistry()

    expect(second.created).toBe(0)
    expect(second.updated).toBe(1)

    const machines = await readMachines()

    expect(machines).toHaveLength(1)
    expect(machines[0].address_).toBe('10.20.30.40')
    expect(machines[0].local_port_).toBe(9100)
  })

  it('leaves a machine an operator switched off switched off', async () => {
    inventory([{ name: FIRST, address: '16.171.242.233', localPort: 9001 }])
    await syncMachineRegistry()

    await db
      .update(machine__machine_)
      .set({ enabled_: false })
      .where(eq(machine__machine_.name_, FIRST))

    await syncMachineRegistry()

    const machines = await readMachines()

    expect(machines[0].enabled_).toBe(false)
  })

  it('keeps a machine the list no longer names, switched off and unreachable', async () => {
    inventory([
      { name: FIRST, address: '16.171.242.233', localPort: 9001 },
      { name: SECOND, address: '16.171.242.234', localPort: 9002 }
    ])
    await syncMachineRegistry()

    inventory([{ name: FIRST, address: '16.171.242.233', localPort: 9001 }])
    const report = await syncMachineRegistry()

    expect(report.retired).toBe(1)

    const machines = await readMachines()

    expect(machines).toHaveLength(2)
    expect(machines[1].name_).toBe(SECOND)
    expect(machines[1].enabled_).toBe(false)
    expect(machines[1].reachable_).toBe(false)
    expect(machines[1].last_error_?.length ?? 0).toBeGreaterThan(0)
  })

  it('registers nothing, and retires nothing, when the deployment says nothing', async () => {
    inventory([{ name: FIRST, address: '16.171.242.233', localPort: 9001 }])
    await syncMachineRegistry()

    process.env.CHECKER_MACHINES = ''
    const report = await syncMachineRegistry()

    expect(report).toEqual({ created: 0, updated: 0, retired: 0 })
    expect((await readMachines())[0].enabled_).toBe(true)
  })

  it('registers nothing when the list is not readable', async () => {
    process.env.CHECKER_MACHINES = 'checker-01, checker-02'

    const report = await syncMachineRegistry()

    expect(report.created).toBe(0)
    expect(await readMachines()).toHaveLength(0)
  })
})
