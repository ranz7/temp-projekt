import { type Database, db } from '@backend/database/db'
import { account__user_, lower } from '@backend/modules/account/schema'
import { BENCHMARK_USERNAME, seedBenchmarkAccount } from '@backend/modules/account/seed'
import { eq } from 'drizzle-orm'

/**
 * The built-in `benchmark` account every batch submits as. It is seeded with the
 * database, and created here if a deployment ever came up without it, so pressing the
 * panel's button never fails for want of an author.
 */
export async function resolveBenchmarkAuthorId(database: Database = db): Promise<string> {
  const found = await readBenchmarkAccount(database)

  if (found !== null) return found

  await seedBenchmarkAccount(database)

  const created = await readBenchmarkAccount(database)

  if (created === null) {
    throw new Error('The benchmark account is missing and could not be created.')
  }

  return created
}

async function readBenchmarkAccount(database: Database): Promise<string | null> {
  const [row] = await database
    .select({ id: account__user_.id })
    .from(account__user_)
    .where(eq(lower(account__user_.username_), BENCHMARK_USERNAME))
    .limit(1)

  return row?.id ?? null
}
