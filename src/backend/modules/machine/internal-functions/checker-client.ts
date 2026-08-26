import {
  CHECKER_CONTRACT_VERSION,
  CHECKER_SERVICE_KEY_HEADER,
  type CheckerFinalResultDTO,
  type CheckerHealthDTO,
  CheckerHealthDTOZ,
  CheckerJobStatusDTOZ,
  CheckerJudgeAcceptedDTOZ,
  type CheckerLanguageDTO
} from '@backend/modules/machine/contract'
import {
  getCheckerRequestTimeoutMs,
  getCheckerServiceKey,
  getCheckerTunnelHost
} from '@backend/modules/machine/internal-functions/settings'

/** Everything a call needs to reach one machine. */
export type CheckerEndpoint = {
  id: string
  name: string
  localPort: number
}

export type CheckerCall = {
  machine: CheckerEndpoint
  method: 'GET' | 'POST'
  path: string
  body?: unknown
  /** `null` on `/health`, which needs no key. */
  serviceKey: string | null
}

export type CheckerReply = {
  status: number
  body: unknown
}

/** How a call reaches a machine. Tests replace it so no socket is ever opened. */
export type CheckerTransport = (call: CheckerCall) => Promise<CheckerReply>

async function fetchTransport(call: CheckerCall): Promise<CheckerReply> {
  const headers = new Headers({ accept: 'application/json' })

  if (call.serviceKey !== null) headers.set(CHECKER_SERVICE_KEY_HEADER, call.serviceKey)
  if (call.body !== undefined) headers.set('content-type', 'application/json')

  const response = await fetch(
    `http://${getCheckerTunnelHost()}:${call.machine.localPort}${call.path}`,
    {
      method: call.method,
      headers,
      body: call.body === undefined ? undefined : JSON.stringify(call.body),
      signal: AbortSignal.timeout(getCheckerRequestTimeoutMs())
    }
  )

  let body: unknown = null

  try {
    body = await response.json()
  } catch {
    // A machine that answers with something that is not JSON still has a status.
  }

  return { status: response.status, body }
}

let transport: CheckerTransport = fetchTransport

/** Points every checker call somewhere else. Used by tests. */
export function setCheckerTransport(replacement: CheckerTransport): void {
  transport = replacement
}

/** Puts the real HTTP transport back. */
export function resetCheckerTransport(): void {
  transport = fetchTransport
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export type HealthOutcome =
  | { reachable: true; health: CheckerHealthDTO }
  | { reachable: false; reason: string }

/** Asks a machine how it is doing. Never throws: a silent machine is an answer too. */
export async function askMachineHealth(machine: CheckerEndpoint): Promise<HealthOutcome> {
  let reply: CheckerReply

  try {
    reply = await transport({ machine, method: 'GET', path: '/health', serviceKey: null })
  } catch (error) {
    return { reachable: false, reason: `The machine did not answer: ${describe(error)}` }
  }

  if (reply.status !== 200) {
    return { reachable: false, reason: `The machine answered ${reply.status} to /health.` }
  }

  const parsed = CheckerHealthDTOZ.safeParse(reply.body)

  if (!parsed.success) {
    return {
      reachable: false,
      reason: `The machine does not speak contract version ${CHECKER_CONTRACT_VERSION}.`
    }
  }

  if (!parsed.data.ok) return { reachable: false, reason: 'The machine reports it is not healthy.' }

  return { reachable: true, health: parsed.data }
}

export type JudgeJob = {
  submissionId: string
  problemSlug: string
  packageDirectory: string
  language: CheckerLanguageDTO
  sourceCode: string
}

export type JudgeOutcome =
  | { accepted: true; jobId: string }
  | { accepted: false; full: boolean; reason: string }

/** Asks a machine to judge one submission. A full machine answers 503 and takes nothing. */
export async function askMachineToJudge(
  machine: CheckerEndpoint,
  job: JudgeJob
): Promise<JudgeOutcome> {
  let reply: CheckerReply

  try {
    reply = await transport({
      machine,
      method: 'POST',
      path: '/judge',
      serviceKey: getCheckerServiceKey(),
      body: { contractVersion: CHECKER_CONTRACT_VERSION, ...job }
    })
  } catch (error) {
    return {
      accepted: false,
      full: false,
      reason: `The machine did not answer: ${describe(error)}`
    }
  }

  if (reply.status === 503) {
    return { accepted: false, full: true, reason: `${machine.name} is full.` }
  }

  if (reply.status !== 202 && reply.status !== 200) {
    return {
      accepted: false,
      full: false,
      reason: `The machine answered ${reply.status} to /judge.`
    }
  }

  const parsed = CheckerJudgeAcceptedDTOZ.safeParse(reply.body)

  if (!parsed.success) {
    return { accepted: false, full: false, reason: 'The machine did not name the job it took.' }
  }

  return { accepted: true, jobId: parsed.data.jobId }
}

export type JobOutcome =
  | { kind: 'running' }
  | { kind: 'done'; result: CheckerFinalResultDTO }
  | { kind: 'lost'; reason: string }

/** Asks a machine what became of a job. An unknown job, or silence, is a lost job. */
export async function askMachineForJob(
  machine: CheckerEndpoint,
  jobId: string
): Promise<JobOutcome> {
  let reply: CheckerReply

  try {
    reply = await transport({
      machine,
      method: 'GET',
      path: `/judge/${encodeURIComponent(jobId)}`,
      serviceKey: getCheckerServiceKey()
    })
  } catch (error) {
    return { kind: 'lost', reason: `The machine stopped answering: ${describe(error)}` }
  }

  if (reply.status === 404) {
    return { kind: 'lost', reason: 'The machine no longer knows this submission.' }
  }

  if (reply.status !== 200) {
    return { kind: 'lost', reason: `The machine answered ${reply.status} for its job.` }
  }

  const parsed = CheckerJobStatusDTOZ.safeParse(reply.body)

  if (!parsed.success) {
    return { kind: 'lost', reason: 'The machine answered something this app cannot read.' }
  }

  if (parsed.data.status === 'running') return { kind: 'running' }

  return { kind: 'done', result: parsed.data.result }
}
