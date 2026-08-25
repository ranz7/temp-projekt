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
import { machine__machine_ } from '@backend/modules/machine/schema'
import { dispatchQueuedSubmissions } from '@backend/modules/submission/internal-functions/dispatcher'
import { UNAVAILABLE_MESSAGE } from '@backend/modules/submission/internal-functions/judging'
import { submission__submission_ } from '@backend/modules/submission/schema'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const FIRST_PORT = 19_101
const SECOND_PORT = 19_102

let problem: FleetProblem
let authorId = ''
let firstMachineId = ''
let secondMachineId = ''
let fleet = new Map<number, FakeMachine>()

async function withFleet(machines: Map<number, FakeMachine>): Promise<void> {
  fleet = machines
  installFakeFleet(fleet)
}

beforeAll(async () => {
  process.env.SERVICE_KEY = 'itest-dispatch-key'
  process.env.SUBMISSION_MAX_ATTEMPTS = '3'
  process.env.SUBMISSION_LEASE_SECONDS = '120'

  await clearFleet()

  problem = await insertProblem('dispatch')
  authorId = await insertAuthor('dispatch-author')
})

beforeEach(async () => {
  await clearSubmissions()
  await db.delete(machine__machine_).where(eq(machine__machine_.local_port_, FIRST_PORT))
  await db.delete(machine__machine_).where(eq(machine__machine_.local_port_, SECOND_PORT))

  firstMachineId = await insertMachine({
    name: 'dispatch-01',
    localPort: FIRST_PORT,
    problems: [problem.packageDirectory]
  })
  secondMachineId = await insertMachine({
    name: 'dispatch-02',
    localPort: SECOND_PORT,
    problems: [problem.packageDirectory]
  })

  await withFleet(
    new Map([
      [FIRST_PORT, fakeMachine()],
      [SECOND_PORT, fakeMachine()]
    ])
  )
})

afterAll(async () => {
  uninstallFakeFleet()
  await clearFleet()
})

describe('dispatchQueuedSubmissions', () => {
  it('hands a waiting solution to a machine that has the problem', async () => {
    const submissionId = await queueSubmission({ problemId: problem.id, authorId })

    const report = await dispatchQueuedSubmissions()

    expect(report.dispatched).toBe(1)

    const row = await readSubmission(submissionId)

    expect(row.status_).toBe('running')
    expect(row.machine_id_).toBe(firstMachineId)
    expect(row.checker_job_id_).toBe(`job-${submissionId}`)
    expect(row.judge_claim_id_).not.toBeNull()
    expect(row.judge_attempts_).toBe(1)
    expect(row.judge_message_).toBeNull()
    expect(row.lease_expires_at_?.getTime() ?? 0).toBeGreaterThan(Date.now())
  })

  it('gives one waiting solution to exactly one of two passes running at once', async () => {
    const submissionId = await queueSubmission({ problemId: problem.id, authorId })

    const [first, second] = await Promise.all([
      dispatchQueuedSubmissions(),
      dispatchQueuedSubmissions()
    ])

    expect(first.dispatched + second.dispatched).toBe(1)

    const judged = [
      ...(fleet.get(FIRST_PORT)?.judged ?? []),
      ...(fleet.get(SECOND_PORT)?.judged ?? [])
    ]

    expect(judged.filter(id => id === submissionId)).toHaveLength(1)
    expect((await readSubmission(submissionId)).judge_attempts_).toBe(1)
  })

  it('leaves a solution queued when every machine is full, and spends no attempt', async () => {
    await withFleet(
      new Map([
        [FIRST_PORT, fakeMachine({ judge: 'full' })],
        [SECOND_PORT, fakeMachine({ judge: 'full' })]
      ])
    )

    const submissionId = await queueSubmission({ problemId: problem.id, authorId })
    const before = (await readSubmission(submissionId)).judge_attempts_

    const report = await dispatchQueuedSubmissions()

    expect(report.dispatched).toBe(0)
    expect(report.refused).toBe(1)

    const row = await readSubmission(submissionId)

    expect(row.status_).toBe('queued')
    expect(row.judge_attempts_).toBe(before)
    expect(row.machine_id_).toBeNull()
    expect(row.checker_job_id_).toBeNull()
    expect(row.judge_claim_id_).toBeNull()
  })

  it('waits, and never fails, when every machine is switched off', async () => {
    await db
      .update(machine__machine_)
      .set({ enabled_: false })
      .where(eq(machine__machine_.id, firstMachineId))
    await db
      .update(machine__machine_)
      .set({ enabled_: false })
      .where(eq(machine__machine_.id, secondMachineId))

    const submissionId = await queueSubmission({ problemId: problem.id, authorId })

    const report = await dispatchQueuedSubmissions()

    expect(report.dispatched).toBe(0)
    expect(report.waiting).toBe(1)

    const row = await readSubmission(submissionId)

    expect(row.status_).toBe('queued')
    expect(row.judge_attempts_).toBe(0)
    expect(row.judge_message_).toBe(UNAVAILABLE_MESSAGE)
  })

  it('skips a machine that does not have the problem on its disk', async () => {
    await db
      .update(machine__machine_)
      .set({ problems_: [] })
      .where(eq(machine__machine_.id, firstMachineId))

    await queueSubmission({ problemId: problem.id, authorId })

    await dispatchQueuedSubmissions()

    expect(fleet.get(FIRST_PORT)?.judged).toHaveLength(0)
    expect(fleet.get(SECOND_PORT)?.judged).toHaveLength(1)
  })

  it('leaves an unreachable machine alone', async () => {
    await db
      .update(machine__machine_)
      .set({ reachable_: false })
      .where(eq(machine__machine_.id, firstMachineId))

    await queueSubmission({ problemId: problem.id, authorId })

    await dispatchQueuedSubmissions()

    expect(fleet.get(FIRST_PORT)?.judged).toHaveLength(0)
    expect(fleet.get(SECOND_PORT)?.judged).toHaveLength(1)
  })

  it('gives a machine no more work than it has room for', async () => {
    await db
      .update(machine__machine_)
      .set({ enabled_: false })
      .where(eq(machine__machine_.id, secondMachineId))
    await db
      .update(machine__machine_)
      .set({ capacity_: 1 })
      .where(eq(machine__machine_.id, firstMachineId))

    await queueSubmission({
      problemId: problem.id,
      authorId,
      createdAt: new Date(Date.now() - 2000)
    })
    await queueSubmission({ problemId: problem.id, authorId })

    const report = await dispatchQueuedSubmissions()

    expect(report.dispatched).toBe(1)
    expect(report.waiting).toBe(1)
  })

  it('takes the oldest waiting solution first', async () => {
    await db
      .update(machine__machine_)
      .set({ enabled_: false })
      .where(eq(machine__machine_.id, secondMachineId))
    await db
      .update(machine__machine_)
      .set({ capacity_: 1 })
      .where(eq(machine__machine_.id, firstMachineId))

    const older = await queueSubmission({
      problemId: problem.id,
      authorId,
      createdAt: new Date('2026-01-01T09:00:00Z')
    })
    await queueSubmission({
      problemId: problem.id,
      authorId,
      createdAt: new Date('2026-01-01T10:00:00Z')
    })

    await dispatchQueuedSubmissions()

    expect(fleet.get(FIRST_PORT)?.judged).toEqual([older])
  })

  it('never hands out a solution that already used every attempt', async () => {
    const submissionId = await queueSubmission({ problemId: problem.id, authorId, attempts: 3 })

    const report = await dispatchQueuedSubmissions()

    expect(report.dispatched).toBe(0)
    expect((await readSubmission(submissionId)).status_).toBe('queued')
    expect(
      await db
        .select({ id: submission__submission_.id })
        .from(submission__submission_)
        .where(eq(submission__submission_.status_, 'running'))
    ).toHaveLength(0)
  })
})
