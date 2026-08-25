import * as schema from '@backend/database/schema'
import { isPreview, isProduction, isTest } from '@shared/environment'
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { getDatabaseConnectionUrl } from './connection'

export type Database = PostgresJsDatabase<typeof schema> & {
  $client?: postgres.Sql<Record<string, unknown>>
}

export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

function initDb(): Database {
  const connectionString = getDatabaseConnectionUrl('application')

  const queryClient = postgres(connectionString, {
    max: isTest() ? 10 : isProduction() || isPreview() ? 2 : 1,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: process.env.DATABASE_SSL === 'require' ? 'require' : undefined
  })

  return drizzlePostgres(queryClient, {
    schema,
    logger: !isTest() && !isProduction()
  })
}

export const db = initDb()
