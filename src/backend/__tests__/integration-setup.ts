import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

const dirname =
  typeof __dirname === 'undefined' ? path.dirname(fileURLToPath(import.meta.url)) : __dirname

const repoRoot = path.resolve(dirname, '../../..')

function loadEnvFiles() {
  config({ path: path.join(repoRoot, '.env'), quiet: true })
  config({ path: path.join(repoRoot, '.env.local'), override: true, quiet: true })
}

function deriveTestDbUrl(dbUrl: string): string {
  const url = new URL(dbUrl)
  url.pathname = '/projekt_test'
  return url.toString()
}

export async function setup() {
  loadEnvFiles()

  const originalUrl =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    'postgres://postgres:postgres@127.0.0.1:5432/projekt'

  const testDbUrl = process.env.CI ? originalUrl : deriveTestDbUrl(originalUrl)
  const testDbName = new URL(testDbUrl).pathname.slice(1)

  process.env.DATABASE_URL = testDbUrl
  process.env.DATABASE_SSL = ''

  const postgres = (await import('postgres')).default
  const { migrate } = await import('drizzle-orm/postgres-js/migrator')
  const { drizzle } = await import('drizzle-orm/postgres-js')
  const migrationsFolder = path.resolve(repoRoot, 'src/backend/database/migrations')

  async function ensureTestDatabase(recreate: boolean) {
    if (process.env.CI) return
    const adminUrl = new URL(originalUrl)
    adminUrl.pathname = '/postgres'
    const adminSql = postgres(adminUrl.toString(), { max: 1, connect_timeout: 5 })
    try {
      if (recreate) {
        await adminSql.unsafe(`DROP DATABASE IF EXISTS "${testDbName}" WITH (FORCE)`)
      }
      await adminSql.unsafe(`CREATE DATABASE "${testDbName}"`)
      console.log(
        `[integration-setup] ${recreate ? 'Recreated' : 'Created'} test database: ${testDbName}`
      )
    } catch (e: unknown) {
      if ((e as { code?: string }).code !== '42P04') {
        await adminSql.end()
        throw new Error(
          `Cannot connect to PostgreSQL. Make sure it is running:\n  bun run db:up\n\n${e}`
        )
      }
    }
    await adminSql.end()
  }

  async function applyMigrations() {
    const client = postgres(testDbUrl, { max: 1 })
    try {
      await migrate(drizzle(client), { migrationsFolder })
    } finally {
      await client.end()
    }
  }

  await ensureTestDatabase(false)
  console.log(`[integration-setup] Applying migrations to ${testDbName}...`)
  try {
    await applyMigrations()
  } catch (e) {
    if (process.env.CI) throw e
    console.warn(`[integration-setup] Migration failed on ${testDbName} - recreating.\n${e}`)
    await ensureTestDatabase(true)
    await applyMigrations()
  }

  console.log('[integration-setup] Database ready')
}

export async function teardown() {
  const { db } = await import('@backend/database/db')
  await db.$client?.end()
  console.log('[integration-setup] Teardown complete')
}
