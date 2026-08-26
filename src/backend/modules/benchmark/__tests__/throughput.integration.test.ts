import { appRouter } from '@backend/appRouter'
import { db } from '@backend/database/db'
import {
  clearBatchesAndSubmissions,
  clearMachines,
  insertTestMachine,
  readBenchmarkAuthor,
  readProblem,
  seedShippedPackages
} from '@backend/modules/benchmark/__tests__/benchmark-fixture'
import { THROUGHPUT_BUCKET_SECONDS } from '@backend/modules/benchmark/internal-functions/settings'
import { type SubmissionStatus, submission__submission_ } from '@backend/modules/submission/schema'
import { createCallerFactory, createTRPCContext } from '@backend/trpc'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const createCaller = createCallerFactory(appRouter)

const PROBLEM = 'minimizing-coins'
const SECOND = 1000

let problemId = ''
let benchmarkUserId = ''

async function panel() {
  return createCaller(
    await createTRPCContext({ headers: new Headers(), resHeaders: new Headers() })
  )
}

/** A submission that reached a final status at a chosen instant, on a chosen machine. */
async function insertFinishedSubmission(input: {
  judgedAt: Date
  status?: SubmissionStatus
  machineId?: string | null
}): Promise<void> {
  await db.insert(submission__submission_).values({
    problem_id_: problemId,
    user_id_: benchmarkUserId,
    language_: 'python',
    source_code_: 'print(1)\n',
    status_: input.status ?? 'accepted',
    created_at_: new Date(input.judgedAt.getTime() - SECOND),
    judged_at_: input.judgedAt,
    machine_id_: input.machineId ?? null
  })
}

async function insertRunningSubmission(machineId: string): Promise<void> {
  await db.insert(submission__submission_).values({
    problem_id_: problemId,
    user_id_: benchmarkUserId,
    language_: 'python',
    source_code_: 'print(1)\n',
    status_: 'running',
    machine_id_: machineId
  })
}

beforeAll(async () => {
  await seedShippedPackages()

  benchmarkUserId = await readBenchmarkAuthor()
  problemId = (await readProblem(PROBLEM)).id
})

beforeEach(async () => {
  await clearBatchesAndSubmissions()
  await clearMachines()
})

afterAll(async () => {
  await clearBatchesAndSubmissions()
  await clearMachines()
})

describe('getThroughput', () => {
  it('reports zero on an idle system', async () => {
    const throughput = await (await panel()).benchmark.getThroughput()

    expect(throughput.bucketSeconds).toBe(THROUGHPUT_BUCKET_SECONDS)
    expect(throughput.windowMinutes).toBe(15)
    expect(throughput.buckets).toHaveLength((15 * 60) / THROUGHPUT_BUCKET_SECONDS)
    expect(throughput.buckets.every(bucket => bucket.finished === 0)).toBe(true)
    expect(throughput.buckets.every(bucket => bucket.finishedPerMinute === 0)).toBe(true)
    expect(throughput.buckets.every(bucket => bucket.machines === 0)).toBe(true)
    expect(throughput.current).toEqual({
      finishedLastMinute: 0,
      finishedPerMinute: 0,
      machinesWorking: 0,
      machinesOnline: 0,
      machinesTotal: 0
    })
  })

  it('counts submissions that really finished, and the machines that finished them', async () => {
    const first = await insertTestMachine({ name: 'itest-throughput-1', localPort: 19_401 })
    const second = await insertTestMachine({ name: 'itest-throughput-2', localPort: 19_402 })
    const justNow = new Date(Date.now() - 2 * SECOND)

    await insertFinishedSubmission({ judgedAt: justNow, machineId: first })
    await insertFinishedSubmission({ judgedAt: justNow, machineId: second })
    await insertFinishedSubmission({
      judgedAt: justNow,
      machineId: second,
      status: 'wrong_answer'
    })

    const throughput = await (await panel()).benchmark.getThroughput()
    const busy = throughput.buckets.filter(bucket => bucket.finished > 0)

    expect(throughput.current.finishedLastMinute).toBe(3)
    expect(throughput.current.finishedPerMinute).toBe(3)
    expect(throughput.current.machinesOnline).toBe(2)
    expect(throughput.current.machinesTotal).toBe(2)
    expect(busy.reduce((total, bucket) => total + bucket.finished, 0)).toBe(3)
    // Three finishes in one fifteen-second bucket read as twelve a minute.
    expect(busy.every(bucket => bucket.finishedPerMinute === bucket.finished * 4)).toBe(true)
    expect(Math.max(...busy.map(bucket => bucket.machines))).toBe(2)
  })

  it('leaves out what is still queued, still running, or older than the window', async () => {
    const machine = await insertTestMachine({ name: 'itest-throughput-3', localPort: 19_403 })

    await insertRunningSubmission(machine)
    await insertFinishedSubmission({
      judgedAt: new Date(Date.now() - 20 * 60 * SECOND),
      machineId: machine
    })

    const throughput = await (await panel()).benchmark.getThroughput()

    expect(throughput.buckets.every(bucket => bucket.finished === 0)).toBe(true)
    expect(throughput.current.finishedLastMinute).toBe(0)
    expect(throughput.current.machinesWorking).toBe(1)
    expect(throughput.current.machinesOnline).toBe(1)
  })

  it('counts a disabled or unreachable machine as offline but still present', async () => {
    await insertTestMachine({ name: 'itest-throughput-4', localPort: 19_404, enabled: false })
    await insertTestMachine({ name: 'itest-throughput-5', localPort: 19_405, reachable: false })
    await insertTestMachine({ name: 'itest-throughput-6', localPort: 19_406 })

    const throughput = await (await panel()).benchmark.getThroughput()

    expect(throughput.current.machinesOnline).toBe(1)
    expect(throughput.current.machinesTotal).toBe(3)
  })

  it('draws a line the whole window wide, oldest bucket first', async () => {
    const throughput = await (await panel()).benchmark.getThroughput({ windowMinutes: 2 })
    const starts = throughput.buckets.map(bucket => bucket.startedAt.getTime())

    expect(throughput.windowMinutes).toBe(2)
    expect(starts).toHaveLength(8)
    expect(starts.every((start, index) => index === 0 || start > starts[index - 1])).toBe(true)
    expect(starts.every(start => start % (THROUGHPUT_BUCKET_SECONDS * SECOND) === 0)).toBe(true)
    expect(Date.now() - starts[starts.length - 1]).toBeLessThan(THROUGHPUT_BUCKET_SECONDS * SECOND)
  })

  it('refuses a window nobody could draw', async () => {
    await expect((await panel()).benchmark.getThroughput({ windowMinutes: 0 })).rejects.toThrow()
    await expect((await panel()).benchmark.getThroughput({ windowMinutes: 1000 })).rejects.toThrow()
  })
})
