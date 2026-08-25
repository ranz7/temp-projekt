import { db } from '@backend/database/db'
import { account__user_ } from '@backend/modules/account/schema'
import { CHECKER_CONTRACT_VERSION } from '@backend/modules/machine/contract'
import {
  type CheckerCall,
  type CheckerReply,
  resetCheckerTransport,
  setCheckerTransport
} from '@backend/modules/machine/internal-functions/checker-client'
import { machine__machine_ } from '@backend/modules/machine/schema'
import {
  submission__submission_,
  submission__test_result_
} from '@backend/modules/submission/schema'
import { task__problem_, task__problem_test_ } from '@backend/modules/task/schema'
import { eq, like, sql } from 'drizzle-orm'

/** Everything this fixture makes carries this, so a run cleans up only after itself. */
export const FLEET_PREFIX = 'itest-fleet-'

export type FakeHealth = {
  ok: boolean
  busy: number
  capacity: number
  problems: string[]
  version: string
}

export type FakeJudge = 'accept' | 'full' | 'silent'

export type FakeJob =
  | { kind: 'running' }
  | { kind: 'done'; result: unknown }
  | { kind: 'missing' }
  | { kind: 'silent' }

/** How a fake machine behaves when the app calls it. */
export type FakeMachine = {
  /** `null` means the machine does not answer `/health` at all. */
  health: FakeHealth | null
  /** What it does with `POST /judge`. */
  judge: FakeJudge
  /** What it says about a job it was given. */
  job: FakeJob
  /** Every submission it was asked to judge, in order. */
  judged: string[]
}

const HEALTHY: FakeHealth = { ok: true, busy: 0, capacity: 2, problems: [], version: 'itest' }

export function fakeMachine(
  overrides: { health?: Partial<FakeHealth> | null; judge?: FakeJudge; job?: FakeJob } = {}
): FakeMachine {
  return {
    health: overrides.health === null ? null : { ...HEALTHY, ...overrides.health },
    judge: overrides.judge ?? 'accept',
    job: overrides.job ?? { kind: 'running' },
    judged: []
  }
}

/** A result a machine reports, with the ordinal-and-visibility rows the contract uses. */
export function fakeResult(
  overrides: {
    status?: string
    score?: number
    maxScore?: number
    tests?: Array<Record<string, unknown>>
  } = {}
): Record<string, unknown> {
  return {
    status: overrides.status ?? 'accepted',
    score: overrides.score ?? 1,
    maxScore: overrides.maxScore ?? 1,
    compileMessage: null,
    maxCpuMs: 12,
    maxMemoryKb: 4096,
    tests: overrides.tests ?? []
  }
}

export function fakeTest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ordinal: 1,
    visibility: 'hidden',
    verdict: 'passed',
    passed: true,
    pointsAwarded: 1,
    message: null,
    actualOutput: null,
    timeMs: 10,
    memoryKb: 2048,
    // The contract lets a machine add these; the app must drop them.
    name: '001',
    presses: null,
    ...overrides
  }
}

/**
 * Answers every checker call from a map of fake machines, keyed by the port their
 * tunnel would end at. No socket is opened.
 */
export function installFakeFleet(fleet: Map<number, FakeMachine>): void {
  setCheckerTransport(async (call: CheckerCall): Promise<CheckerReply> => {
    const machine = fleet.get(call.machine.localPort)

    if (machine === undefined) throw new Error(`Nothing listens on port ${call.machine.localPort}.`)

    if (call.path === '/health') {
      if (machine.health === null) throw new Error('connection refused')

      return { status: 200, body: { contractVersion: CHECKER_CONTRACT_VERSION, ...machine.health } }
    }

    if (call.method === 'POST' && call.path === '/judge') {
      const body = call.body as { submissionId: string }

      machine.judged.push(body.submissionId)

      if (machine.judge === 'silent') throw new Error('connection refused')

      if (machine.judge === 'full') {
        return {
          status: 503,
          body: { contractVersion: CHECKER_CONTRACT_VERSION, error: 'This machine is full.' }
        }
      }

      return {
        status: 202,
        body: { contractVersion: CHECKER_CONTRACT_VERSION, jobId: `job-${body.submissionId}` }
      }
    }

    if (machine.job.kind === 'silent') throw new Error('connection refused')

    if (machine.job.kind === 'missing') {
      return {
        status: 404,
        body: { contractVersion: CHECKER_CONTRACT_VERSION, error: 'No such job.' }
      }
    }

    if (machine.job.kind === 'running') {
      return { status: 200, body: { contractVersion: CHECKER_CONTRACT_VERSION, status: 'running' } }
    }

    return {
      status: 200,
      body: {
        contractVersion: CHECKER_CONTRACT_VERSION,
        status: 'done',
        result: machine.job.result
      }
    }
  })
}

export function uninstallFakeFleet(): void {
  resetCheckerTransport()
}

type MachineRow = {
  name: string
  localPort: number
  enabled?: boolean
  reachable?: boolean
  capacity?: number
  busy?: number
  problems?: string[]
}

export async function insertMachine(row: MachineRow): Promise<string> {
  const [machine] = await db
    .insert(machine__machine_)
    .values({
      name_: `${FLEET_PREFIX}${row.name}`,
      address_: '10.0.0.1',
      local_port_: row.localPort,
      enabled_: row.enabled ?? true,
      reachable_: row.reachable ?? true,
      capacity_: row.capacity ?? 2,
      busy_: row.busy ?? 0,
      problems_: row.problems ?? []
    })
    .returning({ id: machine__machine_.id })

  return machine.id
}

export type FleetProblem = {
  id: string
  slug: string
  packageDirectory: string
  publicTestId: string
  hiddenTestIds: string[]
}

/** One problem with a sample and two hidden tests, enough to match rows by ordinal. */
export async function insertProblem(name: string): Promise<FleetProblem> {
  const slug = `${FLEET_PREFIX}${name}`

  const [problem] = await db
    .insert(task__problem_)
    .values({
      slug_: slug,
      code_: slug.toUpperCase(),
      title_: `Fleet fixture ${name}`,
      statement_: 'Statement',
      difficulty_: 'easy',
      tags_: [],
      languages_: ['python', 'cpp'],
      time_limit_ms_: 1000,
      memory_limit_mb_: 64,
      package_dir_: slug
    })
    .returning({ id: task__problem_.id })

  const tests = await db
    .insert(task__problem_test_)
    .values([
      {
        problem_id_: problem.id,
        ordinal_: 1,
        visibility_: 'public',
        input_: '8\n',
        expected_output_: 'YES\n',
        points_: 0
      },
      {
        problem_id_: problem.id,
        ordinal_: 1,
        visibility_: 'hidden',
        input_member_: '001.in',
        output_member_: '001.out',
        points_: 1
      },
      {
        problem_id_: problem.id,
        ordinal_: 2,
        visibility_: 'hidden',
        input_member_: '002.in',
        output_member_: '002.out',
        points_: 1
      }
    ])
    .returning({
      id: task__problem_test_.id,
      ordinal: task__problem_test_.ordinal_,
      visibility: task__problem_test_.visibility_
    })

  return {
    id: problem.id,
    slug,
    packageDirectory: slug,
    publicTestId: tests.filter(test => test.visibility === 'public')[0].id,
    hiddenTestIds: tests
      .filter(test => test.visibility === 'hidden')
      .sort((left, right) => left.ordinal - right.ordinal)
      .map(test => test.id)
  }
}

export async function insertAuthor(name: string): Promise<string> {
  const [author] = await db
    .insert(account__user_)
    .values({ username_: `${FLEET_PREFIX}${name}` })
    .returning({ id: account__user_.id })

  return author.id
}

export async function queueSubmission(input: {
  problemId: string
  authorId: string
  createdAt?: Date
  attempts?: number
}): Promise<string> {
  const [submission] = await db
    .insert(submission__submission_)
    .values({
      problem_id_: input.problemId,
      user_id_: input.authorId,
      language_: 'python',
      source_code_: 'print("YES")\n',
      status_: 'queued',
      created_at_: input.createdAt ?? new Date(),
      judge_attempts_: input.attempts ?? 0
    })
    .returning({ id: submission__submission_.id })

  return submission.id
}

export async function readSubmission(id: string) {
  const [row] = await db
    .select()
    .from(submission__submission_)
    .where(eq(submission__submission_.id, id))

  return row
}

export async function readTestResults(id: string) {
  return db
    .select()
    .from(submission__test_result_)
    .where(eq(submission__test_result_.submission_id_, id))
}

/** Dispatch and collection both look at every row, so a fleet test needs the tables. */
export async function clearSubmissions(): Promise<void> {
  await db.delete(submission__submission_).where(sql`true`)
}

export async function clearFleet(): Promise<void> {
  await clearSubmissions()
  await db.delete(machine__machine_).where(like(machine__machine_.name_, `${FLEET_PREFIX}%`))
  await db.delete(task__problem_).where(like(task__problem_.slug_, `${FLEET_PREFIX}%`))
  await db.delete(account__user_).where(like(account__user_.username_, `${FLEET_PREFIX}%`))
}
