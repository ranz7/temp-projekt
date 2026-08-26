import { db } from '@backend/database/db'
import {
  clearFleet,
  clearSubmissions,
  type FakeMachine,
  type FleetProblem,
  fakeMachine,
  fakeResult,
  fakeTest,
  insertAuthor,
  insertMachine,
  insertProblem,
  installFakeFleet,
  queueSubmission,
  readSubmission,
  readTestResults,
  uninstallFakeFleet
} from '@backend/modules/machine/__tests__/fleet-fixture'
import { machine__machine_ } from '@backend/modules/machine/schema'
import { collectSubmissionResults } from '@backend/modules/submission/internal-functions/collector'
import { dispatchQueuedSubmissions } from '@backend/modules/submission/internal-functions/dispatcher'
import { applyCheckerResult } from '@backend/modules/submission/internal-functions/judging'
import { submission__submission_ } from '@backend/modules/submission/schema'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const FIRST_PORT = 19_201
const SECOND_PORT = 19_202

let problem: FleetProblem
let authorId = ''
let firstMachineId = ''
let secondMachineId = ''
let fleet = new Map<number, FakeMachine>()

const passedTests = [
  fakeTest({ ordinal: 1, visibility: 'public', pointsAwarded: 0 }),
  fakeTest({ ordinal: 1, visibility: 'hidden', pointsAwarded: 1 }),
  fakeTest({
    ordinal: 2,
    visibility: 'hidden',
    verdict: 'wrong_answer',
    passed: false,
    pointsAwarded: 0
  })
]

/** Queues one solution and lets the dispatcher give it to a machine. */
async function running(): Promise<{ submissionId: string; claimId: string }> {
  const submissionId = await queueSubmission({ problemId: problem.id, authorId })

  await dispatchQueuedSubmissions()

  const row = await readSubmission(submissionId)

  if (row.judge_claim_id_ === null) throw new Error('Expected the submission to be claimed.')

  return { submissionId, claimId: row.judge_claim_id_ }
}

beforeAll(async () => {
  process.env.SERVICE_KEY = 'itest-collect-key'
  process.env.SUBMISSION_MAX_ATTEMPTS = '3'
  process.env.SUBMISSION_LEASE_SECONDS = '120'

  await clearFleet()

  problem = await insertProblem('collect')
  authorId = await insertAuthor('collect-author')
})

beforeEach(async () => {
  await clearSubmissions()
  await db.delete(machine__machine_).where(eq(machine__machine_.local_port_, FIRST_PORT))
  await db.delete(machine__machine_).where(eq(machine__machine_.local_port_, SECOND_PORT))

  firstMachineId = await insertMachine({
    name: 'collect-01',
    localPort: FIRST_PORT,
    problems: [problem.packageDirectory]
  })
  secondMachineId = await insertMachine({
    name: 'collect-02',
    localPort: SECOND_PORT,
    enabled: false,
    problems: [problem.packageDirectory]
  })

  fleet = new Map([
    [FIRST_PORT, fakeMachine()],
    [SECOND_PORT, fakeMachine()]
  ])
  installFakeFleet(fleet)
})

afterAll(async () => {
  uninstallFakeFleet()
  await clearFleet()
})

describe('collectSubmissionResults', () => {
  it('writes the verdict, the score and one row per test, matched by ordinal', async () => {
    const { submissionId } = await running()
    const machine = fleet.get(FIRST_PORT)

    if (machine === undefined) throw new Error('Expected a fake machine.')

    machine.job = {
      kind: 'done',
      result: fakeResult({ status: 'wrong_answer', score: 1, maxScore: 2, tests: passedTests })
    }

    const report = await collectSubmissionResults()

    expect(report.finished).toBe(1)

    const row = await readSubmission(submissionId)

    expect(row.status_).toBe('wrong_answer')
    expect(row.score_).toBe(1)
    expect(row.max_score_).toBe(2)
    expect(row.max_cpu_ms_).toBe(12)
    expect(row.max_memory_kb_).toBe(4096)
    expect(row.judged_at_).not.toBeNull()
    expect(row.judge_claim_id_).toBeNull()
    expect(row.checker_job_id_).toBeNull()
    expect(row.lease_expires_at_).toBeNull()
    expect(row.judge_message_).toBeNull()

    const results = await readTestResults(submissionId)
    const hidden = results
      .filter(test => test.visibility_ === 'hidden')
      .sort((left, right) => left.ordinal_ - right.ordinal_)

    expect(results).toHaveLength(3)
    // Second hidden test failed, so the second hidden row is the failing one.
    expect(hidden.map(test => test.problem_test_id_)).toEqual(problem.hiddenTestIds)
    expect(hidden[0].passed_).toBe(true)
    expect(hidden[1].passed_).toBe(false)
    expect(hidden[1].verdict_).toBe('wrong_answer')
    expect(results.filter(test => test.visibility_ === 'public')[0].problem_test_id_).toBe(
      problem.publicTestId
    )

    const [judged] = await db
      .select({ total: machine__machine_.judged_total_ })
      .from(machine__machine_)
      .where(eq(machine__machine_.id, firstMachineId))

    expect(judged.total).toBe(1)
  })

  it('stores the press counts an interactive problem reported', async () => {
    const { submissionId } = await running()
    const machine = fleet.get(FIRST_PORT)

    if (machine === undefined) throw new Error('Expected a fake machine.')

    machine.job = {
      kind: 'done',
      result: fakeResult({
        status: 'accepted',
        score: 2,
        maxScore: 2,
        tests: [
          fakeTest({ ordinal: 1, visibility: 'public', pointsAwarded: 0, presses: 4 }),
          fakeTest({ ordinal: 1, visibility: 'hidden', presses: 7 }),
          fakeTest({ ordinal: 2, visibility: 'hidden', presses: 11 })
        ]
      })
    }

    await collectSubmissionResults()

    const results = await readTestResults(submissionId)
    const hidden = results
      .filter(test => test.visibility_ === 'hidden')
      .sort((left, right) => left.ordinal_ - right.ordinal_)

    expect(results.filter(test => test.visibility_ === 'public')[0].presses_).toBe(4)
    expect(hidden.map(test => test.presses_)).toEqual([7, 11])
  })

  it('leaves the press count empty for an ordinary problem', async () => {
    const { submissionId } = await running()
    const machine = fleet.get(FIRST_PORT)

    if (machine === undefined) throw new Error('Expected a fake machine.')

    machine.job = {
      kind: 'done',
      result: fakeResult({ status: 'accepted', score: 2, maxScore: 2, tests: passedTests })
    }

    await collectSubmissionResults()

    const results = await readTestResults(submissionId)

    expect(results).toHaveLength(3)
    expect(results.every(test => test.presses_ === null)).toBe(true)
  })

  it('leaves a submission running while its machine is still judging', async () => {
    const { submissionId } = await running()

    const report = await collectSubmissionResults()

    expect(report.running).toBe(1)
    expect((await readSubmission(submissionId)).status_).toBe('running')
  })

  it('ignores a result whose claim was taken over by another machine', async () => {
    const { submissionId, claimId: lostClaimId } = await running()

    // The machine went quiet, the submission went back, another machine took it.
    await db
      .update(submission__submission_)
      .set({
        status_: 'queued',
        judge_claim_id_: null,
        machine_id_: null,
        checker_job_id_: null,
        lease_expires_at_: null
      })
      .where(eq(submission__submission_.id, submissionId))

    await db
      .update(machine__machine_)
      .set({ enabled_: true })
      .where(eq(machine__machine_.id, secondMachineId))
    await db
      .update(machine__machine_)
      .set({ enabled_: false })
      .where(eq(machine__machine_.id, firstMachineId))

    await dispatchQueuedSubmissions()

    const current = await readSubmission(submissionId)

    expect(current.machine_id_).toBe(secondMachineId)
    expect(current.judge_claim_id_).not.toBe(lostClaimId)

    const written = await applyCheckerResult(
      submissionId,
      lostClaimId,
      {
        status: 'accepted',
        score: 2,
        maxScore: 2,
        compileMessage: null,
        maxCpuMs: 1,
        maxMemoryKb: 1,
        tests: []
      },
      db
    )

    expect(written).toBe(false)

    const row = await readSubmission(submissionId)

    expect(row.status_).toBe('running')
    expect(row.judge_claim_id_).toBe(current.judge_claim_id_)
    expect(row.score_).toBeNull()
    expect(await readTestResults(submissionId)).toHaveLength(0)
  })

  it('changes nothing once a submission already has a final verdict', async () => {
    const { submissionId, claimId } = await running()
    const machine = fleet.get(FIRST_PORT)

    if (machine === undefined) throw new Error('Expected a fake machine.')

    machine.job = {
      kind: 'done',
      result: fakeResult({ status: 'accepted', score: 2, maxScore: 2 })
    }
    await collectSubmissionResults()

    const written = await applyCheckerResult(
      submissionId,
      claimId,
      {
        status: 'wrong_answer',
        score: 0,
        maxScore: 2,
        compileMessage: null,
        maxCpuMs: 1,
        maxMemoryKb: 1,
        tests: []
      },
      db
    )

    expect(written).toBe(false)

    const row = await readSubmission(submissionId)

    expect(row.status_).toBe('accepted')
    expect(row.score_).toBe(2)
  })

  it('queues the solution again when its machine forgets the job', async () => {
    const { submissionId } = await running()
    const machine = fleet.get(FIRST_PORT)

    if (machine === undefined) throw new Error('Expected a fake machine.')

    machine.job = { kind: 'missing' }

    const report = await collectSubmissionResults()

    expect(report.requeued).toBe(1)

    const row = await readSubmission(submissionId)

    expect(row.status_).toBe('queued')
    expect(row.machine_id_).toBeNull()
    expect(row.checker_job_id_).toBeNull()
    expect(row.judge_claim_id_).toBeNull()
    // The attempt stays spent: three lost machines still end the submission.
    expect(row.judge_attempts_).toBe(1)
    expect(row.judge_message_?.length ?? 0).toBeGreaterThan(0)
  })

  it('queues the solution again when its machine stops answering', async () => {
    const { submissionId } = await running()
    const machine = fleet.get(FIRST_PORT)

    if (machine === undefined) throw new Error('Expected a fake machine.')

    machine.job = { kind: 'silent' }

    const report = await collectSubmissionResults()

    expect(report.requeued).toBe(1)
    expect((await readSubmission(submissionId)).status_).toBe('queued')
  })

  it('calls the solution an internal error once it has lost three machines', async () => {
    const submissionId = await queueSubmission({ problemId: problem.id, authorId, attempts: 2 })

    await dispatchQueuedSubmissions()

    const machine = fleet.get(FIRST_PORT)

    if (machine === undefined) throw new Error('Expected a fake machine.')

    machine.job = { kind: 'silent' }

    const report = await collectSubmissionResults()

    expect(report.failed).toBe(1)

    const row = await readSubmission(submissionId)

    expect(row.judge_attempts_).toBe(3)
    expect(row.status_).toBe('internal_error')
    expect(row.judged_at_).not.toBeNull()
    expect(row.judge_message_?.length ?? 0).toBeGreaterThan(0)
    expect(row.machine_id_).toBeNull()
  })

  it('still collects the result from a machine disabled after it took the work', async () => {
    const { submissionId } = await running()

    // Disabling stops new work, but this submission is already running there - the
    // spec says whatever it is already judging is allowed to finish.
    await db
      .update(machine__machine_)
      .set({ enabled_: false })
      .where(eq(machine__machine_.id, firstMachineId))

    const machine = fleet.get(FIRST_PORT)

    if (machine === undefined) throw new Error('Expected a fake machine.')

    machine.job = {
      kind: 'done',
      result: fakeResult({ status: 'accepted', score: 2, maxScore: 2, tests: passedTests })
    }

    const report = await collectSubmissionResults()

    expect(report.finished).toBe(1)

    const row = await readSubmission(submissionId)

    expect(row.status_).toBe('accepted')
    expect(row.score_).toBe(2)
  })

  it('treats an answer from a machine speaking an old contract version as lost, not read', async () => {
    const { submissionId } = await running()
    const machine = fleet.get(FIRST_PORT)

    if (machine === undefined) throw new Error('Expected a fake machine.')

    // A machine upgraded mid-flight, or not yet upgraded, cannot make the app read a
    // result shaped for a contract the app no longer - or does not yet - speak.
    machine.job = {
      kind: 'done',
      result: fakeResult({ status: 'accepted', score: 1, maxScore: 1 })
    }
    machine.contractVersionOverride = 1

    const report = await collectSubmissionResults()

    expect(report.requeued).toBe(1)

    const row = await readSubmission(submissionId)

    expect(row.status_).toBe('queued')
    expect(row.machine_id_).toBeNull()
    // The attempt stays spent - the submission is judged again by another machine.
    expect(row.judge_attempts_).toBe(1)
  })
})
