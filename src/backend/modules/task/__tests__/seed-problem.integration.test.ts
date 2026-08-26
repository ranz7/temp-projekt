import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { db } from '@backend/database/db'
import { account__user_, task__problem_, task__problem_test_ } from '@backend/database/schema'
import { seedDatabase } from '@backend/database/seed'
import { lower } from '@backend/modules/account/schema'
import { BENCHMARK_USERNAME } from '@backend/modules/account/seed'
import { getProblemPackagesPath } from '@backend/modules/task/seed'
import { and, count, eq, inArray } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'

/** Every package that ships in `problems/`. */
const SHIPPED_SLUGS = ['cf-4-A', 'combo', 'minimizing-coins', 'rl-nearest-pairs']

type SeededProblem = typeof task__problem_.$inferSelect
type SeededTest = typeof task__problem_test_.$inferSelect

async function problemBySlug(slug: string): Promise<SeededProblem> {
  const [problem] = await db.select().from(task__problem_).where(eq(task__problem_.slug_, slug))

  expect(problem, `expected ${slug} to be seeded`).toBeDefined()

  return problem
}

async function testsOf(problemId: string, visibility: 'public' | 'hidden'): Promise<SeededTest[]> {
  return db
    .select()
    .from(task__problem_test_)
    .where(
      and(
        eq(task__problem_test_.problem_id_, problemId),
        eq(task__problem_test_.visibility_, visibility)
      )
    )
}

async function countProblems(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(task__problem_)

  return row.value
}

async function countTestsOfShippedProblems(): Promise<number> {
  const problems = await db
    .select({ id: task__problem_.id })
    .from(task__problem_)
    .where(inArray(task__problem_.slug_, SHIPPED_SLUGS))
  const [row] = await db
    .select({ value: count() })
    .from(task__problem_test_)
    .where(
      inArray(
        task__problem_test_.problem_id_,
        problems.map(problem => problem.id)
      )
    )

  return row.value
}

let problemsBeforeSeeding = 0

beforeAll(async () => {
  await db.delete(task__problem_).where(inArray(task__problem_.slug_, SHIPPED_SLUGS))
  problemsBeforeSeeding = await countProblems()

  await seedDatabase(db)
})

describe('seeding the shipped problems', () => {
  it('creates exactly the four packages that ship in the repository', async () => {
    const problems = await db
      .select({ slug: task__problem_.slug_ })
      .from(task__problem_)
      .where(inArray(task__problem_.slug_, SHIPPED_SLUGS))

    expect(problems.map(problem => problem.slug).sort()).toEqual([...SHIPPED_SLUGS].sort())
    expect(await countProblems()).toBe(problemsBeforeSeeding + SHIPPED_SLUGS.length)
  })

  it('makes the interactive problem C++ only, with no expected output anywhere', async () => {
    const combo = await problemBySlug('combo')

    expect(combo.kind_).toBe('interactive')
    expect(combo.languages_).toEqual(['cpp'])

    const hidden = await testsOf(combo.id, 'hidden')
    const samples = await testsOf(combo.id, 'public')

    expect(hidden).toHaveLength(68)
    expect(hidden.every(test => test.input_member_ !== null)).toBe(true)
    expect(hidden.every(test => test.output_member_ === null)).toBe(true)
    expect(hidden.every(test => test.points_ === 1)).toBe(true)

    expect(samples).toHaveLength(1)
    expect(samples[0].input_).toBe('ABXYY')
    expect(samples[0].expected_output_).toBeNull()
    expect(samples[0].points_).toBe(0)
  })

  it('gives the coins problem its eighteen hidden tests and one worked example', async () => {
    const coins = await problemBySlug('minimizing-coins')

    const hidden = await testsOf(coins.id, 'hidden')
    const samples = await testsOf(coins.id, 'public')

    expect(hidden).toHaveLength(18)
    expect(hidden.every(test => test.input_member_ !== null && test.output_member_ !== null)).toBe(
      true
    )
    expect(samples).toHaveLength(1)
    expect(samples[0].input_).toBe('3 11\n1 5 7')
    expect(samples[0].expected_output_).toBe('3')
    expect(coins.languages_).toEqual(['python', 'cpp'])
  })

  it('gives the pairing problem twenty hidden tests and its own checker', async () => {
    const pairs = await problemBySlug('rl-nearest-pairs')

    expect(pairs.checker_type_).toBe('custom')
    expect(pairs.checker_path_).toBe('checker/checker.py')
    expect(await testsOf(pairs.id, 'hidden')).toHaveLength(20)
    expect(await testsOf(pairs.id, 'public')).toHaveLength(1)
  })

  it('stores the whole statement of every problem', async () => {
    for (const slug of SHIPPED_SLUGS) {
      const problem = await problemBySlug(slug)

      expect(problem.statement_markdown_, slug).not.toBeNull()
      expect((problem.statement_markdown_ ?? '').trim().length, slug).toBeGreaterThan(0)
    }
  })

  it('keeps the hidden tests themselves off the database', async () => {
    const hiddenInput = await readFile(
      join(getProblemPackagesPath(), 'minimizing-coins', 'tests', '18.in'),
      'utf8'
    )
    const problems = await db
      .select()
      .from(task__problem_)
      .where(inArray(task__problem_.slug_, SHIPPED_SLUGS))
    const tests = await db
      .select()
      .from(task__problem_test_)
      .where(
        inArray(
          task__problem_test_.problem_id_,
          problems.map(problem => problem.id)
        )
      )
    const everythingStored = JSON.stringify([problems, tests])

    expect(hiddenInput.trim().length).toBeGreaterThan(0)
    expect(everythingStored).not.toContain(hiddenInput.trim())
    // Only the file names travel: the tests live on the checkers' own disks.
    expect(everythingStored).toContain('18.in')
  })

  it('gives a problem seeded before Markdown statements the one its package ships', async () => {
    const before = await problemBySlug('cf-4-A')

    await db
      .update(task__problem_)
      .set({ statement_markdown_: null })
      .where(eq(task__problem_.id, before.id))

    await seedDatabase(db)

    const after = await problemBySlug('cf-4-A')

    expect(after.statement_markdown_).toBe(before.statement_markdown_)
    // Everything else about the problem is left alone.
    expect(after.id).toBe(before.id)
    expect(after.created_at_).toEqual(before.created_at_)
  })

  it('adds nothing the second time it runs', async () => {
    const problemsBefore = await countProblems()
    const testsBefore = await countTestsOfShippedProblems()

    await seedDatabase(db)

    expect(await countProblems()).toBe(problemsBefore)
    expect(await countTestsOfShippedProblems()).toBe(testsBefore)
  })
})

describe('the benchmark account', () => {
  it('exists once, however often the seed runs', async () => {
    await seedDatabase(db)

    const accounts = await db
      .select({ id: account__user_.id, username: account__user_.username_ })
      .from(account__user_)
      .where(eq(lower(account__user_.username_), BENCHMARK_USERNAME))

    expect(accounts).toHaveLength(1)
    expect(accounts[0].username).toBe(BENCHMARK_USERNAME)
  })
})
