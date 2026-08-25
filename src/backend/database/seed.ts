import '@backend/database/load-env'
import { db } from '@backend/database/db'

async function seed() {
  await db.$client?.end()
}

seed().catch(error => {
  console.error(error)
  process.exit(1)
})
