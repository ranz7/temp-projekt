import { config as loadEnv } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { getDatabaseConnectionUrl } from '../connection'

loadEnv({ path: '.env', quiet: true })
loadEnv({ path: '.env.local', override: true, quiet: true })

async function run() {
  const url = getDatabaseConnectionUrl('migration')
  const client = postgres(url, { max: 1 })
  try {
    await migrate(drizzle(client), { migrationsFolder: 'src/backend/database/migrations' })
  } finally {
    await client.end()
  }
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})
