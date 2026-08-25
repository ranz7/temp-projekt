import { appRouter } from '@backend/appRouter'
import { db } from '@backend/database/db'
import {
  clearFleet,
  clearSubmissions,
  type FakeMachine,
  type FleetProblem,
  fakeMachine,
  insertAuthor,
  insertMachine,
  insertProblem,
  installFakeFleet,
  queueSubmission,
  readSubmission,
  uninstallFakeFleet
} from '@backend/modules/machine/__tests__/fleet-fixture'
import { pollMachineHealth } from '@backend/modules/machine/internal-functions/machine-health'
import { machine__machine_ } from '@backend/modules/machine/schema'
import { dispatchQueuedSubmissions } from '@backend/modules/submission/internal-functions/dispatcher'
import { createCallerFactory, createTRPCContext } from '@backend/trpc'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const createCaller = createCallerFactory(appRouter)

const FIRST_PORT = 19_301
const SECOND_PORT = 19_302

let problem: FleetProblem
let authorId = ''
let firstMachineId = ''
let secondMachineId = ''
let fleet = new Map<number, FakeMachine>()

async function panel() {
  return createCaller(
    await createTRPCContext({ headers: new Headers(), resHeaders: new Headers() })
  )
}

async function listOurMachines() {
  const { machines } = await (await panel()).machine.listMachines()

  return machines.filter(machine => machine.id === firstMachineId || machine.id === secondMachineId)
}

beforeAll(async () => {
  process.env.SERVICE_KEY = 'itest-panel-key'
  process.env.SUBMISSION_MAX_ATTEMPTS = '3'

  await clearFleet()

  problem = await insertProblem('panel')
  authorId = await insertAuthor('panel-author')
})

beforeEach(async () => {
  await clearSubmissions()
  await db.delete(machine__machine_).where(eq(machine__machine_.local_port_, FIRST_PORT))
  await db.delete(machine__machine_).where(eq(machine__machine_.local_port_, SECOND_PORT))

  firstMachineId = await insertMachine({
    name: 'panel-01',
    localPort: FIRST_PORT,
    reachable: false,
    capacity: 0,
    problems: []
  })
  secondMachineId = await insertMachine({
    name: 'panel-02',
    localPort: SECOND_PORT,
    problems: [problem.packageDirectory]
  })

  fleet = new Map([
    [
      FIRST_PORT,
      fakeMachine({ health: { capacity: 4, busy: 1, problems: [problem.packageDirectory] } })
    ],
    [SECOND_PORT, fakeMachine()]
  ])
  installFakeFleet(fleet)
})

afterAll(async () => {
  uninstallFakeFleet()
  await clearFleet()
})

describe('pollMachineHealth', () => {
  it('writes down what a machine says about itself', async () => {
    await pollMachineHealth()

    const [machine] = await db
      .select()
      .from(machine__machine_)
      .where(eq(machine__machine_.id, firstMachineId))

    expect(machine.reachable_).toBe(true)
    expect(machine.capacity_).toBe(4)
    expect(machine.busy_).toBe(1)
    expect(machine.problems_).toEqual([problem.packageDirectory])
    expect(machine.version_).toBe('itest')
    expect(machine.last_seen_at_).not.toBeNull()
    expect(machine.last_error_).toBeNull()
  })

  it('marks a quiet machine unreachable and takes its work back', async () => {
    const submissionId = await queueSubmission({ problemId: problem.id, authorId })

    await dispatchQueuedSubmissions()

    expect((await readSubmission(submissionId)).machine_id_).toBe(secondMachineId)

    const quiet = fleet.get(SECOND_PORT)

    if (quiet === undefined) throw new Error('Expected a fake machine.')

    quiet.health = null

    const report = await pollMachineHealth()

    expect(report.unreachable).toBe(1)
    expect(report.requeued).toBe(1)

    const [machine] = await db
      .select()
      .from(machine__machine_)
      .where(eq(machine__machine_.id, secondMachineId))

    expect(machine.reachable_).toBe(false)
    expect(machine.last_error_?.length ?? 0).toBeGreaterThan(0)

    const row = await readSubmission(submissionId)

    expect(row.status_).toBe('queued')
    expect(row.machine_id_).toBeNull()
    expect(row.checker_job_id_).toBeNull()
  })
})

describe('machine.listMachines', () => {
  it('shows every machine and how much it is judging right now', async () => {
    await queueSubmission({ problemId: problem.id, authorId })
    await dispatchQueuedSubmissions()

    const machines = await listOurMachines()
    const busy = machines.filter(machine => machine.id === secondMachineId)[0]
    const idle = machines.filter(machine => machine.id === firstMachineId)[0]

    expect(machines).toHaveLength(2)
    expect(busy.name.endsWith('panel-02')).toBe(true)
    expect(busy.judgingNow).toBe(1)
    expect(busy.enabled).toBe(true)
    expect(busy.reachable).toBe(true)
    expect(busy.problems).toEqual([problem.packageDirectory])
    expect(idle.judgingNow).toBe(0)
    expect(idle.reachable).toBe(false)
  })
})

describe('machine.setMachineEnabled', () => {
  it('switches a machine off, and dispatch stops choosing it', async () => {
    const trpc = await panel()

    const off = await trpc.machine.setMachineEnabled({
      machineId: secondMachineId,
      enabled: false
    })

    expect(off.enabled).toBe(false)

    const submissionId = await queueSubmission({ problemId: problem.id, authorId })

    await dispatchQueuedSubmissions()

    expect((await readSubmission(submissionId)).status_).toBe('queued')
    expect(fleet.get(SECOND_PORT)?.judged).toHaveLength(0)

    const on = await trpc.machine.setMachineEnabled({ machineId: secondMachineId, enabled: true })

    expect(on.enabled).toBe(true)

    await dispatchQueuedSubmissions()

    expect((await readSubmission(submissionId)).machine_id_).toBe(secondMachineId)
  })

  it('answers not found for a machine nobody has', async () => {
    const trpc = await panel()

    await expect(
      trpc.machine.setMachineEnabled({
        machineId: '00000000-0000-4000-8000-000000000001',
        enabled: false
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
