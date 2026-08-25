import { randomUUID, timingSafeEqual } from 'node:crypto'
import { type Database, db } from '@backend/database/db'
import {
  type CheckerAcknowledgementDTO,
  type CheckerLanguageDTO,
  type ClaimJobRequestDTO,
  type ClaimJobResponseDTO,
  ClaimJobResponseDTOZ,
  type FinalResultRequestDTO,
  type JobTestDTO,
  type ReleaseJobRequestDTO,
  type ResultRequestDTO,
  type SubmissionClaimDTO
} from '@backend/modules/submission/contract'
import {
  PENDING_SUBMISSION_STATUSES,
  type SubmissionStatus,
  submission__submission_,
  submission__test_result_
} from '@backend/modules/submission/schema'
import { task__problem_, task__problem_test_ } from '@backend/modules/task/schema'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

/** The only contract the checkers and this app both speak. */
export const CONTRACT_VERSION = 1

/** Header carrying the shared key. Checker calls never use cookies. */
export const SERVICE_KEY_HEADER = 'x-service-key'

const DEFAULT_LEASE_SECONDS = 60
const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_QUEUE_REPOST_SECONDS = 10
const DEFAULT_SWEEP_SECONDS = 10

/** How many workers the sticky-drain memory keeps before dropping the oldest. */
const STICKY_WORKER_LIMIT = 500

function readPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name]

  if (raw === undefined || raw.trim() === '') return fallback

  const parsed = Number.parseInt(raw.trim(), 10)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** How long a claim stays valid without a heartbeat. */
export function getLeaseSeconds(): number {
  return readPositiveInteger('SUBMISSION_LEASE_SECONDS', DEFAULT_LEASE_SECONDS)
}

/** How many times a submission may be handed out before it is called an error. */
export function getMaxJudgeAttempts(): number {
  return readPositiveInteger('SUBMISSION_MAX_ATTEMPTS', DEFAULT_MAX_ATTEMPTS)
}

/** How old a wake-up may get before the sweeper sends it again. */
export function getQueueRepostSeconds(): number {
  return readPositiveInteger('SUBMISSION_QUEUE_REPOST_SECONDS', DEFAULT_QUEUE_REPOST_SECONDS)
}

/** How often the standalone sweeper runs. */
export function getSweepSeconds(): number {
  return readPositiveInteger('SUBMISSION_SWEEP_SECONDS', DEFAULT_SWEEP_SECONDS)
}

/**
 * Whether the caller carries the shared key. An unset `SERVICE_KEY` refuses everybody
 * rather than letting an unconfigured deployment accept anything.
 */
export function isAuthorisedChecker(headers: Headers): boolean {
  const expected = process.env.SERVICE_KEY

  if (expected === undefined || expected.length === 0) return false

  const given = headers.get(SERVICE_KEY_HEADER)

  if (given === null) return false

  const expectedBytes = Buffer.from(expected, 'utf8')
  const givenBytes = Buffer.from(given, 'utf8')

  // Length already leaks through the comparison itself, so compare a same-sized
  // pair and let the length decide afterwards.
  if (givenBytes.length !== expectedBytes.length) {
    timingSafeEqual(expectedBytes, expectedBytes)

    return false
  }

  return timingSafeEqual(givenBytes, expectedBytes)
}

function checkerJson<Payload extends object>(payload: Payload, status = 200): Response {
  return Response.json(payload, { status })
}

function checkerError(status: number, message: string): Response {
  return checkerJson({ contractVersion: CONTRACT_VERSION, error: message }, status)
}

/** Every successful checker call answers this, plus whatever the endpoint adds. */
export function acknowledgement(): CheckerAcknowledgementDTO {
  return { contractVersion: CONTRACT_VERSION }
}

export function acknowledgementResponse(): Response {
  return checkerJson(acknowledgement())
}

export function claimResponse(payload: ClaimJobResponseDTO): Response {
  return checkerJson(payload)
}

type ReadRequestResult<Payload> = { ok: true; payload: Payload } | { ok: false; response: Response }

/**
 * Shared front door of the four checker endpoints: shared key, then contract version,
 * then the endpoint's own shape. Keeps the route files free of logic.
 */
export async function readCheckerRequest<Payload>(
  request: Request,
  schema: z.ZodType<Payload>
): Promise<ReadRequestResult<Payload>> {
  if (!isAuthorisedChecker(request.headers)) {
    return { ok: false, response: checkerError(401, 'A valid service key is required.') }
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return { ok: false, response: checkerError(400, 'The request body is not JSON.') }
  }

  const version = z.object({ contractVersion: z.literal(CONTRACT_VERSION) }).safeParse(body)

  if (!version.success) {
    return {
      ok: false,
      response: checkerError(400, `This app speaks contract version ${CONTRACT_VERSION} only.`)
    }
  }

  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return {
      ok: false,
      response: checkerError(400, 'The request does not match the checker contract.')
    }
  }

  return { ok: true, payload: parsed.data }
}

/**
 * Which problem each worker is currently draining, so the next claim prefers that
 * problem's queue - the spec's sticky drain. Only a hint: a miss simply hands out
 * the oldest waiting submission instead.
 */
const stickyProblemByWorker = new Map<string, string>()

function rememberStickyProblem(workerId: string, problemId: string): void {
  stickyProblemByWorker.delete(workerId)
  stickyProblemByWorker.set(workerId, problemId)

  while (stickyProblemByWorker.size > STICKY_WORKER_LIMIT) {
    const oldest = stickyProblemByWorker.keys().next()

    if (oldest.done === true) break

    stickyProblemByWorker.delete(oldest.value)
  }
}

/** Drops the sticky-drain memory. Used by tests. */
export function forgetStickyProblems(): void {
  stickyProblemByWorker.clear()
}

function leaseExpiry() {
  return sql`now() + make_interval(secs => ${getLeaseSeconds()}::double precision)`
}

function isPending(status: SubmissionStatus): boolean {
  return PENDING_SUBMISSION_STATUSES.some(pending => pending === status)
}

const ClaimedRowDTOZ = z.object({
  id: z.uuid(),
  problem_id_: z.uuid(),
  language_: z.enum(['python', 'cpp']),
  source_code_: z.string()
})

/** Samples first, hidden tests after, each block in the problem's own numbering. */
const testOrder = sql`case ${task__problem_test_.visibility_} when 'public' then 0 else 1 end`

type ClaimedSubmission = {
  submissionId: string
  claimId: string
  problemId: string
  language: CheckerLanguageDTO
  sourceCode: string
}

async function buildJobPayload(
  database: Database,
  claim: ClaimedSubmission
): Promise<ClaimJobResponseDTO> {
  const [problem] = await database
    .select({
      slug: task__problem_.slug_,
      packageDir: task__problem_.package_dir_,
      timeLimitMs: task__problem_.time_limit_ms_,
      memoryLimitMb: task__problem_.memory_limit_mb_,
      checkerType: task__problem_.checker_type_,
      checkerPath: task__problem_.checker_path_
    })
    .from(task__problem_)
    .where(eq(task__problem_.id, claim.problemId))
    .limit(1)

  const testRows = await database
    .select({
      id: task__problem_test_.id,
      visibility: task__problem_test_.visibility_,
      points: task__problem_test_.points_,
      input: task__problem_test_.input_,
      expectedOutput: task__problem_test_.expected_output_,
      inputMember: task__problem_test_.input_member_,
      outputMember: task__problem_test_.output_member_
    })
    .from(task__problem_test_)
    .where(eq(task__problem_test_.problem_id_, claim.problemId))
    .orderBy(testOrder, task__problem_test_.ordinal_)

  const tests: JobTestDTO[] = []

  for (const row of testRows) {
    // The job numbers tests 1..n across the whole run; the problem numbers samples
    // and hidden tests separately. The worker answers with `problemTestId`, so the
    // two numberings never have to agree.
    const ordinal = tests.length + 1

    if (row.visibility === 'public') {
      tests.push({
        problemTestId: row.id,
        ordinal,
        visibility: 'public',
        points: row.points,
        input: row.input ?? '',
        expectedOutput: row.expectedOutput ?? ''
      })

      continue
    }

    if (row.inputMember === null || row.outputMember === null) {
      console.warn(`[judging] Hidden test ${row.id} names no files and cannot be run.`)

      continue
    }

    // Only the file names travel. Hidden input and expected output stay in Postgres
    // and on the checker's mounted package directory.
    tests.push({
      problemTestId: row.id,
      ordinal,
      visibility: 'hidden',
      points: row.points,
      inputFile: row.inputMember,
      outputFile: row.outputMember
    })
  }

  // Parsing the answer strips anything the shapes above do not name, so no hidden
  // test content can leave here even if a column is added later.
  return ClaimJobResponseDTOZ.parse({
    contractVersion: CONTRACT_VERSION,
    job: {
      submissionId: claim.submissionId,
      claimId: claim.claimId,
      problemSlug: problem.slug,
      packageDirectory: problem.packageDir,
      language: claim.language,
      sourceCode: claim.sourceCode,
      timeLimitMs: problem.timeLimitMs,
      memoryLimitMb: problem.memoryLimitMb,
      checkerType: problem.checkerType,
      checkerPath: problem.checkerType === 'custom' ? problem.checkerPath : null,
      tests
    }
  })
}

/**
 * Hands one waiting submission to a worker, or nothing when none matches.
 *
 * The claim is a single guarded `UPDATE ... RETURNING` over a row picked with
 * `FOR UPDATE SKIP LOCKED`, so two workers racing for the last submission can
 * never both win it.
 */
export async function claimSubmission(
  input: ClaimJobRequestDTO,
  database: Database = db
): Promise<ClaimJobResponseDTO> {
  const claimId = randomUUID()
  const stickyProblemId = stickyProblemByWorker.get(input.workerId) ?? null
  const languages = sql.join(
    input.languages.map(language => sql`${language}`),
    sql`, `
  )
  // A worker draining a problem keeps taking that problem's queue before anything else.
  const stickyFirst =
    stickyProblemId === null ? sql`` : sql`(s.problem_id_ = ${stickyProblemId}::uuid) desc,`

  const rows = await database.execute(sql`
    with candidate as (
      select s.id
      from submission__submission_ s
      where s.status_ = 'queued'
        and s.language_ in (${languages})
        and s.judge_attempts_ < ${getMaxJudgeAttempts()}
      order by ${stickyFirst} s.created_at_ asc, s.id asc
      limit 1
      for update skip locked
    )
    update submission__submission_ as target
    set status_ = 'running',
        judge_claim_id_ = ${claimId}::uuid,
        lease_expires_at_ = now() + make_interval(secs => ${getLeaseSeconds()}::double precision),
        judge_attempts_ = target.judge_attempts_ + 1
    from candidate
    where target.id = candidate.id
      and target.status_ = 'queued'
    returning target.id, target.problem_id_, target.language_, target.source_code_
  `)

  const claimed = ClaimedRowDTOZ.safeParse(rows.at(0))

  if (!claimed.success) return { contractVersion: CONTRACT_VERSION, job: null }

  rememberStickyProblem(input.workerId, claimed.data.problem_id_)

  return buildJobPayload(database, {
    submissionId: claimed.data.id,
    claimId,
    problemId: claimed.data.problem_id_,
    language: claimed.data.language_,
    sourceCode: claimed.data.source_code_
  })
}

/**
 * Pushes the lease out. Only the active claim of a still-running submission moves;
 * anything else is a worker that already lost the job, and changes nothing.
 */
export async function extendClaimLease(
  input: SubmissionClaimDTO,
  database: Database = db
): Promise<CheckerAcknowledgementDTO> {
  await database
    .update(submission__submission_)
    .set({ lease_expires_at_: leaseExpiry() })
    .where(
      and(
        eq(submission__submission_.id, input.submissionId),
        eq(submission__submission_.judge_claim_id_, input.claimId),
        eq(submission__submission_.status_, 'running')
      )
    )

  return acknowledgement()
}

async function applyFinalResult(input: FinalResultRequestDTO, database: Database): Promise<void> {
  await database.transaction(async transaction => {
    const [current] = await transaction
      .select({
        id: submission__submission_.id,
        problemId: submission__submission_.problem_id_,
        status: submission__submission_.status_,
        claimId: submission__submission_.judge_claim_id_
      })
      .from(submission__submission_)
      .where(eq(submission__submission_.id, input.submissionId))
      .limit(1)
      .for('update')

    // Already judged, or judged by somebody else since this worker lost its lease.
    if (!current) return
    if (!isPending(current.status)) return
    if (current.claimId !== input.claimId) return

    const problemTests = await transaction
      .select({
        id: task__problem_test_.id,
        ordinal: task__problem_test_.ordinal_,
        visibility: task__problem_test_.visibility_
      })
      .from(task__problem_test_)
      .where(eq(task__problem_test_.problem_id_, current.problemId))

    const knownTests = new Map(problemTests.map(test => [test.id, test]))

    // Number and visibility come from the problem, never from the worker's report.
    const rows = input.tests.flatMap(test => {
      const problemTest = knownTests.get(test.problemTestId)

      if (problemTest === undefined) return []

      return [
        {
          submission_id_: current.id,
          problem_test_id_: problemTest.id,
          ordinal_: problemTest.ordinal,
          visibility_: problemTest.visibility,
          verdict_: test.verdict,
          passed_: test.passed,
          points_awarded_: Math.round(test.pointsAwarded),
          message_: test.message,
          actual_output_: test.actualOutput,
          time_ms_: test.timeMs,
          memory_kb_: test.memoryKb
        }
      ]
    })

    await transaction
      .delete(submission__test_result_)
      .where(eq(submission__test_result_.submission_id_, current.id))

    if (rows.length > 0) await transaction.insert(submission__test_result_).values(rows)

    await transaction
      .update(submission__submission_)
      .set({
        status_: input.status,
        score_: Math.round(input.score),
        max_score_: Math.round(input.maxScore),
        compile_message_: input.compileMessage,
        // A judged submission no longer waits on anything, so any "unavailable" note goes.
        judge_message_: null,
        max_cpu_ms_: input.maxCpuMs,
        max_memory_kb_: input.maxMemoryKb,
        judged_at_: sql`now()`,
        lease_expires_at_: null,
        judge_claim_id_: null
      })
      .where(eq(submission__submission_.id, current.id))
  })
}

/**
 * Records a worker's progress report or its final verdict. Every write is fenced on the
 * claim id, and a submission that already has a final status ignores anything later.
 */
export async function applySubmissionResult(
  input: ResultRequestDTO,
  database: Database = db
): Promise<CheckerAcknowledgementDTO> {
  if (input.status === 'running') {
    // Progress: the submission is already running, so this only says the worker lives.
    await extendClaimLease(input, database)

    return acknowledgement()
  }

  await applyFinalResult(input, database)

  return acknowledgement()
}

/**
 * Gives a claim back without judging it - the spec's OIOIOI outage. The attempt is
 * handed back too, so an outage can never turn a submission into an error.
 */
export async function releaseSubmissionClaim(
  input: ReleaseJobRequestDTO,
  database: Database = db
): Promise<CheckerAcknowledgementDTO> {
  await database.transaction(async transaction => {
    const [current] = await transaction
      .select({
        id: submission__submission_.id,
        status: submission__submission_.status_,
        claimId: submission__submission_.judge_claim_id_
      })
      .from(submission__submission_)
      .where(eq(submission__submission_.id, input.submissionId))
      .limit(1)
      .for('update')

    if (!current) return
    if (current.status !== 'running') return
    if (current.claimId !== input.claimId) return

    await transaction
      .update(submission__submission_)
      .set({
        status_: 'queued',
        judge_claim_id_: null,
        lease_expires_at_: null,
        // Not this submission's fault - the attempt goes back.
        judge_attempts_: sql`greatest(${submission__submission_.judge_attempts_} - 1, 0)`,
        judge_message_: input.reason,
        // The sweeper wakes a worker for it again.
        queue_published_at_: null
      })
      .where(eq(submission__submission_.id, current.id))
  })

  return acknowledgement()
}
