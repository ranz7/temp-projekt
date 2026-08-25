import { db } from '@backend/database/db'
import { readSessionUserId } from '@backend/modules/account/internal-functions/session'

export type ProcedureMeta = {
  operation: string
  procedureKind: 'query' | 'mutation'
}

export type TRPCContext = {
  db: typeof db
  headers: Headers
  /** Headers of the response being built - where login cookies are set. Null off the HTTP path. */
  resHeaders: Headers | null
  /** Signed-in user, resolved from the request cookie. Never read from the request body. */
  userId: string | null
}

export async function createTRPCContext(opts: {
  headers: Headers
  resHeaders?: Headers
}): Promise<TRPCContext> {
  return {
    db,
    headers: opts.headers,
    resHeaders: opts.resHeaders ?? null,
    userId: readSessionUserId(opts.headers.get('cookie'))
  }
}
