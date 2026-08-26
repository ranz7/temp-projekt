/** How deep to follow `cause` before giving up. Postgres errors nest one or two levels. */
const MAX_DEPTH = 5

/**
 * Whether a write was refused by one particular unique index.
 *
 * The driver wraps the database's own error, so the index name is on the wrapped
 * cause rather than the message the caller first sees - checking only the top-level
 * message quietly misses every real collision.
 */
export function violatesUniqueIndex(error: unknown, indexName: string): boolean {
  let current: unknown = error

  for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
    if (typeof current !== 'object' || current === null) return false

    const record: { message?: unknown; constraint?: unknown; cause?: unknown } = current

    if (record.constraint === indexName) return true
    if (typeof record.message === 'string' && record.message.includes(indexName)) return true

    current = record.cause
  }

  return false
}
