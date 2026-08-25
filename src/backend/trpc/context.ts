import { db } from '@backend/database/db'

export type ProcedureMeta = {
  operation: string
  procedureKind: 'query' | 'mutation'
}

export type TRPCContext = {
  db: typeof db
  headers: Headers
}

export async function createTRPCContext(opts: { headers: Headers }): Promise<TRPCContext> {
  return {
    db,
    headers: opts.headers
  }
}
