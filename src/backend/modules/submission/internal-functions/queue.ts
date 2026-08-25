import Redis from 'ioredis'

/** Redis used only to nudge a checker awake; a submission is judged with or without it. */
const DEFAULT_REDIS_URL = 'redis://127.0.0.1:6379'
/** Stream the checkers listen on. One entry names one submission. */
const DEFAULT_STREAM_NAME = 'oj.submissions'
/** Roughly how many wake-ups the stream keeps, so it cannot grow without bound. */
const STREAM_MAX_LENGTH = 10_000
/** A wake-up is a nicety - it never keeps a person waiting for longer than this. */
const PUBLISH_TIMEOUT_MS = 2_000

export function getSubmissionQueueUrl(): string {
  return process.env.REDIS_URL ?? DEFAULT_REDIS_URL
}

export function getSubmissionStreamName(): string {
  return process.env.REDIS_STREAM ?? DEFAULT_STREAM_NAME
}

type ConnectedClient = {
  url: string
  client: Redis
}

let connected: ConnectedClient | null = null

function createClient(url: string): Redis {
  const client = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 1_000,
    maxRetriesPerRequest: 1,
    // One failed attempt ends the client instead of reconnecting forever. The next
    // publish builds a fresh one, so a Redis that comes back is picked up again.
    retryStrategy: () => null
  })

  // An ioredis error event with no listener would take the whole process down.
  client.on('error', () => {})
  client.on('end', () => {
    if (connected?.client === client) connected = null
  })

  return client
}

/** The shared wake-up client, rebuilt whenever `REDIS_URL` changes or the last one died. */
export function getSubmissionQueueClient(): Redis {
  const url = getSubmissionQueueUrl()

  if (connected && connected.url === url) return connected.client

  if (connected) connected.client.disconnect()

  const client = createClient(url)
  connected = { url, client }

  return client
}

async function withTimeout<Value>(operation: Promise<Value>): Promise<Value> {
  let timer: ReturnType<typeof setTimeout> | undefined

  const expiry = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Redis did not answer in time.')), PUBLISH_TIMEOUT_MS)
  })

  try {
    return await Promise.race([operation, expiry])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Tells a checker a submission is waiting. Never throws: when Redis is unreachable the
 * submission simply stays queued until the sweeper republishes it.
 *
 * @returns whether the wake-up actually reached Redis.
 */
export async function publishSubmissionWakeUp(submissionId: string): Promise<boolean> {
  try {
    const client = getSubmissionQueueClient()

    await withTimeout(
      client.xadd(
        getSubmissionStreamName(),
        'MAXLEN',
        '~',
        STREAM_MAX_LENGTH,
        '*',
        'submissionId',
        submissionId
      )
    )

    return true
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)

    console.warn(
      `[submission] Could not wake a checker for submission ${submissionId}: ${reason}. The sweeper will queue it again.`
    )

    return false
  }
}

/** Drops the shared client. Used by tests and by a worker shutting down. */
export function closeSubmissionQueue(): void {
  const current = connected

  connected = null
  current?.client.disconnect()
}
