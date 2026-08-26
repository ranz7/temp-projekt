import '@backend/database/load-env'
import { fileURLToPath } from 'node:url'
import { type Database, db } from '@backend/database/db'
import { seedBenchmarkAccount } from '@backend/modules/account/seed'
import { seedTaskProblems } from '@backend/modules/task/seed'

/** Everything a fresh database needs: the shipped problems and the benchmark account. */
export async function seedDatabase(database: Database = db): Promise<void> {
  await seedTaskProblems(database)
  await seedBenchmarkAccount(database)
}

const isRunDirectly = process.argv[1] === fileURLToPath(import.meta.url)

if (isRunDirectly) {
  seedDatabase(db)
    .then(async () => {
      await db.$client?.end()
    })
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
}
