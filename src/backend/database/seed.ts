import '@backend/database/load-env'
import { db } from '@backend/database/db'
import { seedTaskProblems } from '@backend/modules/task/seed'

export async function seedDatabase(): Promise<void> {
  await seedTaskProblems(db)
  await db.$client?.end()
}

seedDatabase().catch(error => {
  console.error(error)
  process.exit(1)
})
