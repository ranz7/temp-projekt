import { appRouter } from '@backend/appRouter'
import { db } from '@backend/database/db'
import {
  clearBatchesAndSubmissions,
  clearMachines,
  insertTestMachine,
  seedShippedPackages
} from '@backend/modules/benchmark/__tests__/benchmark-fixture'
import { waitForScalingRun } from '@backend/modules/benchmark/internal-functions/scaling-runner'
import {
  benchmark__batch_,
  benchmark__scaling_run_,
  benchmark__scaling_step_
} from '@backend/modules/benchmark/schema'
import { machine__machine_ } from '@backend/modules/machine/schema'
import { submission__submission_ } from '@backend/modules/submission/schema'
import { createCallerFactory, createTRPCContext } from '@backend/trpc'
import { asc, eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const createCaller = createCallerFactory(appRouter)

const PROBLEM = 'cf-4-A'

async function panel() {
  return createCaller(
    await createTRPCContext({ headers: new Headers(), resHeaders: new Headers() })
  )
}

/**
 * Nothing judges in an integration test, so a run would wait for verdicts for ever.
 * Standing in for the fleet, this marks everything queued as judged, which is exactly
 * what a checker's answer does to the row.
 */
async function judgeEverything(): Promise<void> {
  await db
    .update(submission__submission_)
    .set({ status_: 'accepted', judged_at_: sql`now()`, score_: 1, max_score_: 1 })
    .where(eq(submission__submission_.status_, 'queued'))
}

async function judgeUntilRunEnds(): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    await judgeEverything()

    const [run] = await db
      .select({ status: benchmark__scaling_run_.status_ })
      .from(benchmark__scaling_run_)
      .orderBy(sql`${benchmark__scaling_run_.started_at_} desc`)
      .limit(1)

    if (run !== undefined && run.status !== 'running') return

    await new Promise(resolve => setTimeout(resolve, 50))
  }
}

async function readMachines() {
  return db
    .select({ name: machine__machine_.name_, enabled: machine__machine_.enabled_ })
    .from(machine__machine_)
    .orderBy(asc(machine__machine_.name_))
}

beforeAll(async () => {
  await seedShippedPackages()
  process.env.BENCHMARK_SUBMISSION_INTERVAL_MS = '0'
})

beforeEach(async () => {
  await db.delete(benchmark__scaling_run_).where(sql`true`)
  await clearBatchesAndSubmissions()
  await clearMachines()
})

afterAll(async () => {
  await db.delete(benchmark__scaling_run_).where(sql`true`)
  await clearBatchesAndSubmissions()
  await clearMachines()
})

describe('measuring what another machine buys', () => {
  it("climbs one machine at a time and times every rung by the judge's own clock", async () => {
    await insertTestMachine({ name: 'checker-a', localPort: 9001 })
    await insertTestMachine({ name: 'checker-b', localPort: 9002 })
    await insertTestMachine({ name: 'checker-c', localPort: 9003 })

    const caller = await panel()
    const started = await caller.benchmark.startScalingRun({
      problemSlug: PROBLEM,
      submissionsPerStep: 2
    })

    expect(started.maxMachines).toBe(3)

    await judgeUntilRunEnds()
    await waitForScalingRun()

    const { run } = await caller.benchmark.getScalingRun()

    expect(run?.status).toBe('completed')
    expect(run?.steps.map(step => step.machineCount)).toEqual([1, 2, 3])

    for (const step of run?.steps ?? []) {
      expect(step.sent, `step ${step.machineCount} sent`).toBe(2)
      expect(step.accepted, `step ${step.machineCount} accepted`).toBe(2)
      expect(step.isFinished, `step ${step.machineCount} finished`).toBe(true)
      expect(step.wallMs, `step ${step.machineCount} timing`).toBeGreaterThan(0)
      expect(step.perMinute, `step ${step.machineCount} rate`).toBeGreaterThan(0)
    }
  })

  it('sends nothing but correct solutions, because that is what it counts', async () => {
    await insertTestMachine({ name: 'checker-a', localPort: 9001 })

    const caller = await panel()
    await caller.benchmark.startScalingRun({ problemSlug: PROBLEM, submissionsPerStep: 5 })

    await judgeUntilRunEnds()
    await waitForScalingRun()

    const batches = await db.select().from(benchmark__batch_)

    expect(batches).toHaveLength(1)
    expect(batches[0].correct_percent_).toBe(100)

    const { run } = await caller.benchmark.getScalingRun()

    expect(run?.steps[0].accepted).toBe(5)
  })

  it('leaves every machine working again once it is done', async () => {
    await insertTestMachine({ name: 'checker-a', localPort: 9001 })
    await insertTestMachine({ name: 'checker-b', localPort: 9002 })

    const caller = await panel()
    await caller.benchmark.startScalingRun({ problemSlug: PROBLEM, submissionsPerStep: 1 })

    await judgeUntilRunEnds()
    await waitForScalingRun()

    expect(await readMachines()).toEqual([
      { name: 'checker-a', enabled: true },
      { name: 'checker-b', enabled: true }
    ])
  })

  it('puts a machine the operator had switched off back to switched off', async () => {
    await insertTestMachine({ name: 'checker-a', localPort: 9001 })
    await insertTestMachine({ name: 'checker-b', localPort: 9002, enabled: false })

    const caller = await panel()
    await caller.benchmark.startScalingRun({ problemSlug: PROBLEM, submissionsPerStep: 1 })

    await judgeUntilRunEnds()
    await waitForScalingRun()

    expect(await readMachines()).toEqual([
      { name: 'checker-a', enabled: true },
      { name: 'checker-b', enabled: false }
    ])
  })

  it('refuses to measure when no machine is answering', async () => {
    await insertTestMachine({ name: 'checker-a', localPort: 9001, reachable: false })

    const caller = await panel()

    await expect(
      caller.benchmark.startScalingRun({ problemSlug: PROBLEM, submissionsPerStep: 1 })
    ).rejects.toThrow(/nothing to measure/i)
  })

  it('runs one measurement at a time', async () => {
    await insertTestMachine({ name: 'checker-a', localPort: 9001 })

    const caller = await panel()
    await caller.benchmark.startScalingRun({ problemSlug: PROBLEM, submissionsPerStep: 4 })

    await expect(
      caller.benchmark.startScalingRun({ problemSlug: PROBLEM, submissionsPerStep: 4 })
    ).rejects.toThrow(/already/i)

    await judgeUntilRunEnds()
    await waitForScalingRun()
  })

  it('stops when asked, and leaves no batch running behind it', async () => {
    await insertTestMachine({ name: 'checker-a', localPort: 9001 })
    await insertTestMachine({ name: 'checker-b', localPort: 9002 })

    const caller = await panel()
    await caller.benchmark.startScalingRun({ problemSlug: PROBLEM, submissionsPerStep: 3 })

    const stopped = await caller.benchmark.stopScalingRun({})

    expect(stopped.stopped).toBe(true)

    await judgeUntilRunEnds()
    await waitForScalingRun()

    const { run } = await caller.benchmark.getScalingRun()

    expect(run?.status).toBe('stopped')

    const stillRunning = await db
      .select({ id: benchmark__batch_.id })
      .from(benchmark__batch_)
      .where(eq(benchmark__batch_.status_, 'running'))

    expect(stillRunning).toHaveLength(0)
    expect(await readMachines()).toEqual([
      { name: 'checker-a', enabled: true },
      { name: 'checker-b', enabled: true }
    ])
  })

  it('records which machines each rung used', async () => {
    await insertTestMachine({ name: 'checker-a', localPort: 9001 })
    await insertTestMachine({ name: 'checker-b', localPort: 9002 })

    const caller = await panel()
    await caller.benchmark.startScalingRun({ problemSlug: PROBLEM, submissionsPerStep: 1 })

    await judgeUntilRunEnds()
    await waitForScalingRun()

    const steps = await db
      .select({ machineCount: benchmark__scaling_step_.machine_count_ })
      .from(benchmark__scaling_step_)
      .orderBy(asc(benchmark__scaling_step_.machine_count_))

    expect(steps.map(step => step.machineCount)).toEqual([1, 2])
  })
})
