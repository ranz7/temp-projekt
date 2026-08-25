import { config as loadEnv } from 'dotenv'
import { defineConfig } from 'drizzle-kit'
import { getDatabaseConnectionUrl } from './src/backend/database/connection'

loadEnv({ path: '.env', quiet: true })
loadEnv({ path: '.env.local', override: true, quiet: true })

const url = getDatabaseConnectionUrl('migration')

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/backend/database/schema.ts',
  out: './src/backend/database/migrations',
  dbCredentials: {
    url,
    ssl: process.env.DATABASE_SSL === 'require' ? 'require' : false
  },
  verbose: true,
  strict: false
})
