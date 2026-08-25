import { z } from 'zod'

const DEFAULT_TUNNEL_HOST = '127.0.0.1'
const DEFAULT_REQUEST_TIMEOUT_SECONDS = 10
const DEFAULT_HEALTH_SECONDS = 5
const DEFAULT_DISPATCH_SECONDS = 1
const DEFAULT_RESULT_SECONDS = 2

/** One checker machine as the inventory file names it. */
export const ConfiguredMachineDTOZ = z.object({
  name: z.string().min(1).max(64),
  address: z.string().min(1).max(255),
  localPort: z.number().int().positive().max(65535)
})

export const ConfiguredMachineListDTOZ = z.array(ConfiguredMachineDTOZ)

export type ConfiguredMachine = z.infer<typeof ConfiguredMachineDTOZ>

export function readPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name]

  if (raw === undefined || raw.trim() === '') return fallback

  const parsed = Number.parseInt(raw.trim(), 10)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * The machines this deployment knows, from `CHECKER_MACHINES`.
 *
 * `null` means the deployment said nothing - an unset or unreadable value never
 * retires the fleet. An empty array is an answer: no machines.
 */
export function readConfiguredMachines(): ConfiguredMachine[] | null {
  const raw = process.env.CHECKER_MACHINES

  if (raw === undefined || raw.trim() === '') return null

  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    console.warn('[machine] CHECKER_MACHINES is not JSON. No machine was registered.')

    return null
  }

  const machines = ConfiguredMachineListDTOZ.safeParse(parsed)

  if (!machines.success) {
    console.warn(
      '[machine] CHECKER_MACHINES must be a list of { name, address, localPort }. No machine was registered.'
    )

    return null
  }

  return machines.data
}

/**
 * Where the SSH tunnels to the checkers end. Each machine answers on this host at its
 * own local port, so the checker service itself never leaves its own loopback.
 */
export function getCheckerTunnelHost(): string {
  const raw = process.env.CHECKER_TUNNEL_HOST

  return raw === undefined || raw.trim() === '' ? DEFAULT_TUNNEL_HOST : raw.trim()
}

/** How long one call to a machine may take before it counts as no answer. */
export function getCheckerRequestTimeoutMs(): number {
  return (
    readPositiveInteger('CHECKER_REQUEST_TIMEOUT_SECONDS', DEFAULT_REQUEST_TIMEOUT_SECONDS) * 1000
  )
}

/** The shared key every call but `/health` carries, or `null` when none is configured. */
export function getCheckerServiceKey(): string | null {
  const raw = process.env.SERVICE_KEY

  return raw === undefined || raw.length === 0 ? null : raw
}

/** How often every machine is asked how it is doing. */
export function getHealthPollSeconds(): number {
  return readPositiveInteger('CHECKER_HEALTH_SECONDS', DEFAULT_HEALTH_SECONDS)
}

/** How often waiting submissions are handed out. */
export function getDispatchSeconds(): number {
  return readPositiveInteger('CHECKER_DISPATCH_SECONDS', DEFAULT_DISPATCH_SECONDS)
}

/** How often the machines are asked what became of the submissions they hold. */
export function getResultPollSeconds(): number {
  return readPositiveInteger('CHECKER_RESULT_SECONDS', DEFAULT_RESULT_SECONDS)
}
