import { appRouter } from '@backend/appRouter'
import { db } from '@backend/database/db'
import {
  clearBatchesAndSubmissions,
  countSubmissions,
  delay,
  readBatchRow,
  readBatchSubmissions,
  readBenchmarkAuthor,
  readProblem,
  seedShippedPackages
} from '@backend/modules/benchmark/__tests__/benchmark-fixture'
import { waitForBenchmarkBatch } from '@backend/modules/benchmark/internal-functions/batch-runner'
import { benchmark__batch_ } from '@backend/modules/benchmark/schema'
import { submission__submission_ } from '@backend/modules/submission/schema'
import { createCallerFactory, createTRPCContext } from '@backend/trpc'
import { inArray, sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const createCaller = createCallerFactory(appRouter)

const PYTHON_PROBLEM = 'minimizing-coins'
const CPP_PROBLEM = 'combo'

let benchmarkUserId = ''

async function panel() {
  return createCaller(
    await createTRPCContext({ headers: new Headers(), resHeaders: new Headers() })
  )
}

/** Submissions are created as fast as the database allows, so a test never waits. */
function createInstantly(): void {
  process.env.BENCHMARK_SUBMISSION_INTERVAL_MS = '0'
}

function createEvery(milliseconds: number): void {
  process.env.BENCHMARK_SUBMISSION_INTERVAL_MS = String(milliseconds)
}

beforeAll(async () => {
  await seedShippedPackages()
  benchmarkUserId = await readBenchmarkAuthor()
})

beforeEach(async () => {
  await waitForBenchmarkBatch()
  await clearBatchesAndSubmissions()
  createInstantly()
})

afterAll(async () => {
  await waitForBenchmarkBatch()
  await clearBatchesAndSubmissions()
  delete process.env.BENCHMARK_SUBMISSION_INTERVAL_MS
})

describe('startBatch', () => {
  it('sends the asked-for number of ordinary submissions by the benchmark account', async () => {
    const problem = await readProblem(PYTHON_PROBLEM)
    const batch = await (await panel()).benchmark.startBatch({
      problemSlug: PYTHON_PROBLEM,
      count: 10
    })

    await waitForBenchmarkBatch()

    const submissions = await readBatchSubmissions(batch.id)

    expect(submissions).toHaveLength(10)
    expect(submissions.every(row => row.userId === benchmarkUserId)).toBe(true)
    expect(submissions.every(row => row.problemId === problem.id)).toBe(true)
    expect(submissions.every(row => problem.languages.includes(row.language))).toBe(true)
    expect(submissions.every(row => row.status === 'queued')).toBe(true)
  })

  it('uses C++ for combo, the only language it accepts', async () => {
    const problem = await readProblem(CPP_PROBLEM)
    const batch = await (await panel()).benchmark.startBatch({
      problemSlug: CPP_PROBLEM,
      count: 4
    })

    await waitForBenchmarkBatch()

    expect(batch.language).toBe('cpp')
    expect(problem.languages).toEqual(['cpp'])

    const submissions = await readBatchSubmissions(batch.id)

    expect(submissions.every(row => row.language === 'cpp')).toBe(true)
    expect(submissions.every(row => row.sourceCode.includes('guess_sequence'))).toBe(true)
  })

  it('mixes roughly seven correct solutions in ten', async () => {
    const batch = await (await panel()).benchmark.startBatch({
      problemSlug: PYTHON_PROBLEM,
      count: 100
    })

    await waitForBenchmarkBatch()

    const submissions = await readBatchSubmissions(batch.id)
    const correct = submissions.filter(row => row.expectsAccepted)
    const sources = new Set(submissions.map(row => row.sourceCode))

    expect(submissions).toHaveLength(100)
    expect(correct.length).toBeGreaterThanOrEqual(60)
    expect(correct.length).toBeLessThanOrEqual(80)
    // Two different files went out, not one file labelled two ways.
    expect(sources.size).toBe(2)
    expect(correct.every(row => row.sourceCode.includes('Unbounded knapsack'))).toBe(true)
  })

  it('refuses a batch of none and a batch of more than five hundred', async () => {
    const caller = await panel()

    await expect(
      caller.benchmark.startBatch({ problemSlug: PYTHON_PROBLEM, count: 0 })
    ).rejects.toThrow()
    await expect(
      caller.benchmark.startBatch({ problemSlug: PYTHON_PROBLEM, count: 501 })
    ).rejects.toThrow()
    await waitForBenchmarkBatch()

    expect(await countSubmissions()).toBe(0)

    const batches = await db.select({ id: benchmark__batch_.id }).from(benchmark__batch_)

    expect(batches).toHaveLength(0)
  })

  it('refuses a second batch while one is running', async () => {
    createEvery(200)

    const caller = await panel()
    const first = await caller.benchmark.startBatch({ problemSlug: PYTHON_PROBLEM, count: 5 })

    await expect(
      caller.benchmark.startBatch({ problemSlug: CPP_PROBLEM, count: 5 })
    ).rejects.toThrow(/already running/u)

    await caller.benchmark.stopBatch()
    await waitForBenchmarkBatch()

    const batches = await db.select({ id: benchmark__batch_.id }).from(benchmark__batch_)

    expect(batches.map(row => row.id)).toEqual([first.id])
    expect(await countSubmissions()).toBeLessThanOrEqual(5)
  })

  it('refuses a problem nobody ships solutions for', async () => {
    await expect(
      (await panel()).benchmark.startBatch({ problemSlug: 'no-such-problem', count: 5 })
    ).rejects.toThrow(/could not find/u)
  })
})

describe('stopBatch', () => {
  it('stops new submissions appearing and leaves the ones already sent alone', async () => {
    createEvery(40)

    const caller = await panel()
    const batch = await caller.benchmark.startBatch({ problemSlug: PYTHON_PROBLEM, count: 60 })

    await delay(200)

    const stopped = await caller.benchmark.stopBatch()

    await waitForBenchmarkBatch()

    const sentWhenStopped = await readBatchSubmissions(batch.id)
    const row = await readBatchRow(batch.id)

    expect(stopped.stopped).toBe(true)
    expect(stopped.id).toBe(batch.id)
    expect(row.status_).toBe('stopped')
    expect(row.ended_at_).not.toBeNull()
    expect(sentWhenStopped.length).toBeGreaterThan(0)
    expect(sentWhenStopped.length).toBeLessThan(60)
    expect(row.created_count_).toBe(sentWhenStopped.length)

    await delay(150)

    const laterSubmissions = await readBatchSubmissions(batch.id)

    expect(laterSubmissions.map(submission => submission.id)).toEqual(
      sentWhenStopped.map(submission => submission.id)
    )
    // Nothing was cancelled: they are all still waiting to be judged.
    expect(laterSubmissions.every(submission => submission.status === 'queued')).toBe(true)
  })

  it('says so quietly when nothing is running', async () => {
    const stopped = await (await panel()).benchmark.stopBatch()

    expect(stopped).toEqual({ stopped: false, id: null, createdCount: 0 })
  })
})

describe('getBatchStatus', () => {
  it('has nothing to report before any batch was sent', async () => {
    expect(await (await panel()).benchmark.getBatchStatus()).toEqual({ batch: null })
  })

  it('counts what was sent, what finished, and every verdict', async () => {
    const caller = await panel()
    const batch = await caller.benchmark.startBatch({ problemSlug: PYTHON_PROBLEM, count: 10 })

    await waitForBenchmarkBatch()

    const beforeJudging = await caller.benchmark.getBatchStatus()

    expect(beforeJudging.batch?.id).toBe(batch.id)
    expect(beforeJudging.batch?.problemSlug).toBe(PYTHON_PROBLEM)
    expect(beforeJudging.batch?.status).toBe('completed')
    expect(beforeJudging.batch?.requestedCount).toBe(10)
    expect(beforeJudging.batch?.createdCount).toBe(10)
    expect(beforeJudging.batch?.finishedCount).toBe(0)
    expect(beforeJudging.batch?.pendingCount).toBe(10)
    expect(beforeJudging.batch?.verdicts).toEqual([])

    const submissions = await readBatchSubmissions(batch.id)

    await finish(
      submissions.slice(0, 6).map(row => row.id),
      'accepted'
    )
    await finish(
      submissions.slice(6, 9).map(row => row.id),
      'wrong_answer'
    )

    const midway = await caller.benchmark.getBatchStatus()

    expect(midway.batch?.finishedCount).toBe(9)
    expect(midway.batch?.pendingCount).toBe(1)
    expect(midway.batch?.verdicts).toEqual([
      { status: 'accepted', count: 6 },
      { status: 'wrong_answer', count: 3 }
    ])

    await finish([submissions[9].id], 'time_limit')

    const afterAllJudged = await caller.benchmark.getBatchStatus()

    expect(afterAllJudged.batch?.finishedCount).toBe(10)
    expect(afterAllJudged.batch?.pendingCount).toBe(0)
    expect(afterAllJudged.batch?.verdicts).toEqual([
      { status: 'accepted', count: 6 },
      { status: 'wrong_answer', count: 3 },
      { status: 'time_limit', count: 1 }
    ])
  })

  it('prefers the running batch over a newer finished one', async () => {
    const caller = await panel()
    const finished = await caller.benchmark.startBatch({ problemSlug: PYTHON_PROBLEM, count: 2 })

    await waitForBenchmarkBatch()

    createEvery(200)

    const running = await caller.benchmark.startBatch({ problemSlug: CPP_PROBLEM, count: 5 })
    const status = await caller.benchmark.getBatchStatus()

    await caller.benchmark.stopBatch()
    await waitForBenchmarkBatch()

    expect(finished.id).not.toBe(running.id)
    expect(status.batch?.id).toBe(running.id)
    expect(status.batch?.status).toBe('running')
  })
})

/** Marks submissions finished the way a machine's result would. */
async function finish(ids: string[], status: 'accepted' | 'wrong_answer' | 'time_limit') {
  await db
    .update(submission__submission_)
    .set({ status_: status, judged_at_: sql`now()` })
    .where(inArray(submission__submission_.id, ids))
}
