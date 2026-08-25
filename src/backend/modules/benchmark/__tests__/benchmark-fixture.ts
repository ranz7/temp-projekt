import { db } from '@backend/database/db'
import { seedDatabase } from '@backend/database/seed'
import { account__user_, lower } from '@backend/modules/account/schema'
import { BENCHMARK_USERNAME } from '@backend/modules/account/seed'
import { benchmark__batch_, benchmark__batch_submission_ } from '@backend/modules/benchmark/schema'
import { machine__machine_ } from '@backend/modules/machine/schema'
import { submission__submission_ } from '@backend/modules/submission/schema'
import { task__problem_ } from '@backend/modules/task/schema'
import { eq, sql } from 'drizzle-orm'

/** The shipped problems and the benchmark account, both idempotent. */
export async function seedShippedPackages(): Promise<void> {
  await seedDatabase(db)
}

export async function readBenchmarkAuthor(): Promise<string> {
  const [row] = await db
    .select({ id: account__user_.id })
    .from(account__user_)
    .where(eq(lower(account__user_.username_), BENCHMARK_USERNAME))
    .limit(1)

  return row.id
}

export async function readProblem(slug: string) {
  const [row] = await db
    .select({
      id: task__problem_.id,
      slug: task__problem_.slug_,
      languages: task__problem_.languages_
    })
    .from(task__problem_)
    .where(eq(task__problem_.slug_, slug))
    .limit(1)

  return row
}

/** Every batch and every submission, so one test file never reads another's rows. */
export async function clearBatchesAndSubmissions(): Promise<void> {
  await db.delete(benchmark__batch_).where(sql`true`)
  await db.delete(submission__submission_).where(sql`true`)
}

export async function clearMachines(): Promise<void> {
  await db.delete(machine__machine_).where(sql`true`)
}

export async function insertTestMachine(input: {
  name: string
  localPort: number
  enabled?: boolean
  reachable?: boolean
}): Promise<string> {
  const [machine] = await db
    .insert(machine__machine_)
    .values({
      name_: input.name,
      address_: '10.0.0.1',
      local_port_: input.localPort,
      enabled_: input.enabled ?? true,
      reachable_: input.reachable ?? true
    })
    .returning({ id: machine__machine_.id })

  return machine.id
}

/** The submissions one batch sent, newest last, with what it expected of each. */
export async function readBatchSubmissions(batchId: string) {
  return db
    .select({
      id: submission__submission_.id,
      problemId: submission__submission_.problem_id_,
      userId: submission__submission_.user_id_,
      language: submission__submission_.language_,
      status: submission__submission_.status_,
      sourceCode: submission__submission_.source_code_,
      expectsAccepted: benchmark__batch_submission_.expects_accepted_
    })
    .from(benchmark__batch_submission_)
    .innerJoin(
      submission__submission_,
      eq(submission__submission_.id, benchmark__batch_submission_.submission_id_)
    )
    .where(eq(benchmark__batch_submission_.batch_id_, batchId))
    .orderBy(submission__submission_.id)
}

export async function countSubmissions(): Promise<number> {
  const [row] = await db.select({ total: sql<number>`count(*)::int` }).from(submission__submission_)

  return row.total
}

export async function readBatchRow(batchId: string) {
  const [row] = await db
    .select()
    .from(benchmark__batch_)
    .where(eq(benchmark__batch_.id, batchId))
    .limit(1)

  return row
}

export function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}
