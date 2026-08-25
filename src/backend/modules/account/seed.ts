import { type Database, db } from '@backend/database/db'
import { account__user_, lower } from '@backend/modules/account/schema'
import { eq } from 'drizzle-orm'

/**
 * The account the admin panel submits its benchmark batches as. Nothing about it
 * is special: its submissions appear on the homepage and in the ranking like
 * anyone else's. The name is simply reserved.
 */
export const BENCHMARK_USERNAME = 'benchmark'

/** Creates the benchmark account once. Running this again changes nothing. */
export async function seedBenchmarkAccount(database: Database = db): Promise<void> {
  const existing = await database
    .select({ id: account__user_.id })
    .from(account__user_)
    .where(eq(lower(account__user_.username_), BENCHMARK_USERNAME))
    .limit(1)

  if (existing.length > 0) {
    return
  }

  await database.insert(account__user_).values({ username_: BENCHMARK_USERNAME })
}
