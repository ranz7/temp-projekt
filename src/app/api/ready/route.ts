import { db } from '@backend/database/db'
import { sql } from 'drizzle-orm'

/**
 * Readiness: 200 only when the app can actually serve a page.
 *
 * The one thing every page needs is the database, so that is the one thing
 * checked. When it is unreachable the answer is 503 carrying the reason the
 * driver gave, which is what an operator staring at a red container wants.
 */
export const dynamic = 'force-dynamic'

/**
 * A healthcheck runs every few seconds, so this one never waits longer than
 * that. A database that has not answered by now is not ready, whatever the
 * driver eventually decides.
 */
const ANSWER_WITHIN_MS = 4000

/** The innermost message, because the outer wrapper only says "failed query". */
function rootCause(error: unknown): string {
  let current = error

  while (current instanceof Error && current.cause !== undefined) {
    current = current.cause
  }

  return current instanceof Error ? current.message : String(current)
}

function tooSlow(): Promise<never> {
  return new Promise((_resolve, reject) => {
    setTimeout(
      () => reject(new Error(`The database did not answer within ${ANSWER_WITHIN_MS} ms.`)),
      ANSWER_WITHIN_MS
    ).unref()
  })
}

export async function GET(): Promise<Response> {
  try {
    await Promise.race([db.execute(sql`select 1`), tooSlow()])

    return Response.json({ status: 'ready', database: 'ok' })
  } catch (error) {
    return Response.json(
      { status: 'not-ready', database: 'unreachable', detail: rootCause(error) },
      { status: 503 }
    )
  }
}
