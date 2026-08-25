import '@backend/database/load-env'
import { db } from '@backend/database/db'
import { seedNotes } from '@backend/modules/note/seed'

async function seed() {
  await seedNotes()
  await db.$client?.end()
}

seed().catch(error => {
  console.error(error)
  process.exit(1)
})
