export type DatabaseConnectionRole = 'application' | 'migration'

/**
 * Resolve the connection URL for one database workload.
 * Dedicated migration URL is optional so local development stays one-line.
 */
export function getDatabaseConnectionUrl(role: DatabaseConnectionRole): string {
  const dedicated = role === 'migration' ? process.env.MIGRATION_DATABASE_URL?.trim() : undefined
  const fallback = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
  const connectionString = dedicated || fallback?.trim()

  if (!connectionString) {
    throw new Error('DATABASE_URL is not set')
  }

  return connectionString
}
