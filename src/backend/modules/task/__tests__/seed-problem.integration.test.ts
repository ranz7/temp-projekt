import { db } from '@backend/database/db'
import { task__problem_, task__problem_test_ } from '@backend/database/schema'
import { seedTaskProblems } from '@backend/modules/task/seed'
import { and, eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

const SEEDED_PROBLEM_SLUG = 'cf-4-A'
const HIDDEN_TEST_COUNT = 20

async function deleteSeededProblem(): Promise<void> {
  await db.delete(task__problem_).where(eq(task__problem_.slug_, SEEDED_PROBLEM_SLUG))
}

afterEach(async () => {
  await deleteSeededProblem()
})

describe('seedTaskProblems', () => {
  it('seeds the shipped problem once and keeps hidden test contents out of Postgres', async () => {
    await deleteSeededProblem()

    await seedTaskProblems(db)

    const problems = await db
      .select()
      .from(task__problem_)
      .where(eq(task__problem_.slug_, SEEDED_PROBLEM_SLUG))

    expect(problems).toHaveLength(1)
    expect(problems[0].package_dir_).toBe(SEEDED_PROBLEM_SLUG)
    expect(problems[0].languages_).toEqual(['python', 'cpp'])

    const publicTests = await db
      .select()
      .from(task__problem_test_)
      .where(
        and(
          eq(task__problem_test_.problem_id_, problems[0].id),
          eq(task__problem_test_.visibility_, 'public')
        )
      )

    expect(publicTests).toHaveLength(1)
    expect(publicTests[0].ordinal_).toBe(1)
    expect(publicTests[0].input_).toBe('8')
    expect(publicTests[0].expected_output_).toBe('YES')
    expect(publicTests[0].input_member_).toBeNull()
    expect(publicTests[0].output_member_).toBeNull()

    const hiddenTests = await db
      .select()
      .from(task__problem_test_)
      .where(
        and(
          eq(task__problem_test_.problem_id_, problems[0].id),
          eq(task__problem_test_.visibility_, 'hidden')
        )
      )

    expect(hiddenTests).toHaveLength(HIDDEN_TEST_COUNT)
    expect(hiddenTests.every(test => test.input_ === null && test.expected_output_ === null)).toBe(
      true
    )
    expect(
      hiddenTests.every(test => test.input_member_ !== null && test.output_member_ !== null)
    ).toBe(true)
    expect(hiddenTests.every(test => test.points_ === 1)).toBe(true)

    await seedTaskProblems(db)

    const problemRowsAfterSecondSeed = await db
      .select()
      .from(task__problem_)
      .where(eq(task__problem_.slug_, SEEDED_PROBLEM_SLUG))
    const testRowsAfterSecondSeed = await db
      .select()
      .from(task__problem_test_)
      .where(eq(task__problem_test_.problem_id_, problems[0].id))

    expect(problemRowsAfterSecondSeed).toHaveLength(1)
    expect(testRowsAfterSecondSeed).toHaveLength(1 + HIDDEN_TEST_COUNT)
  })
})
