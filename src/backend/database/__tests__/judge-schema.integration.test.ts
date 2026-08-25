import { db } from '@backend/database/db'
import {
  account__user_,
  submission__submission_,
  submission__test_result_,
  task__problem_,
  task__problem_test_
} from '@backend/database/schema'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

const createdUserIds: string[] = []
const createdProblemIds: string[] = []
let rowCounter = 0

function nextSuffix(): string {
  rowCounter += 1
  return `${Date.now()}-${rowCounter}`
}

async function insertUser() {
  const [user] = await db
    .insert(account__user_)
    .values({ username_: `judge-schema-${nextSuffix()}` })
    .returning()
  createdUserIds.push(user.id)
  return user
}

async function insertProblem() {
  const [problem] = await db
    .insert(task__problem_)
    .values({
      slug_: `judge-schema-${nextSuffix()}`,
      code_: '4A',
      title_: 'Watermelon',
      statement_: 'Split the watermelon into two even parts.',
      difficulty_: 'easy',
      rating_: 800,
      tags_: ['math', 'brute force'],
      languages_: ['python', 'cpp'],
      time_limit_ms_: 1000,
      memory_limit_mb_: 64,
      package_dir_: 'cf-4-A'
    })
    .returning()
  createdProblemIds.push(problem.id)
  return problem
}

afterEach(async () => {
  for (const problemId of createdProblemIds.splice(0)) {
    await db.delete(task__problem_).where(eq(task__problem_.id, problemId))
  }
  for (const userId of createdUserIds.splice(0)) {
    await db.delete(account__user_).where(eq(account__user_.id, userId))
  }
})

describe('online judge tables', () => {
  it('stores a user, a problem, its tests, a submission and one test result', async () => {
    const user = await insertUser()
    const problem = await insertProblem()

    const tests = await db
      .insert(task__problem_test_)
      .values([
        {
          problem_id_: problem.id,
          ordinal_: 1,
          visibility_: 'public',
          input_: '8\n',
          expected_output_: 'YES\n',
          explanation_: 'Eight splits into two even parts.'
        },
        {
          problem_id_: problem.id,
          ordinal_: 1,
          visibility_: 'hidden',
          input_member_: '01.in',
          output_member_: '01.out',
          points_: 10
        }
      ])
      .returning()

    const publicTest = tests.find(test => test.visibility_ === 'public')
    const hiddenTest = tests.find(test => test.visibility_ === 'hidden')
    expect(publicTest?.input_).toBe('8\n')
    expect(publicTest?.points_).toBe(0)
    expect(hiddenTest?.input_).toBeNull()
    expect(hiddenTest?.input_member_).toBe('01.in')

    const [submission] = await db
      .insert(submission__submission_)
      .values({
        problem_id_: problem.id,
        user_id_: user.id,
        language_: 'python',
        source_code_: 'print("YES")'
      })
      .returning()

    expect(submission.status_).toBe('queued')
    expect(submission.judge_attempts_).toBe(0)
    expect(submission.judged_at_).toBeNull()
    expect(submission.created_at_).toBeInstanceOf(Date)

    if (!hiddenTest) throw new Error('hidden test was not inserted')

    const [result] = await db
      .insert(submission__test_result_)
      .values({
        submission_id_: submission.id,
        problem_test_id_: hiddenTest.id,
        ordinal_: 1,
        visibility_: 'hidden',
        verdict_: 'passed',
        passed_: true,
        points_awarded_: 10,
        time_ms_: 12,
        memory_kb_: 4096
      })
      .returning()

    const readBack = await db
      .select()
      .from(submission__test_result_)
      .where(eq(submission__test_result_.submission_id_, submission.id))

    expect(readBack).toHaveLength(1)
    expect(readBack[0].id).toBe(result.id)
    expect(readBack[0].verdict_).toBe('passed')
    expect(readBack[0].points_awarded_).toBe(10)

    const storedProblem = await db
      .select()
      .from(task__problem_)
      .where(eq(task__problem_.id, problem.id))

    expect(storedProblem[0].tags_).toEqual(['math', 'brute force'])
    expect(storedProblem[0].languages_).toEqual(['python', 'cpp'])
    expect(storedProblem[0].kind_).toBe('stdio')
    expect(storedProblem[0].io_mode_).toBe('stdio')
    expect(storedProblem[0].checker_type_).toBe('token')
    expect(storedProblem[0].is_published_).toBe(true)
  })

  it('refuses a second test with the same problem, visibility and number', async () => {
    const problem = await insertProblem()

    await db
      .insert(task__problem_test_)
      .values({ problem_id_: problem.id, ordinal_: 1, visibility_: 'hidden', points_: 10 })

    await expect(
      db
        .insert(task__problem_test_)
        .values({ problem_id_: problem.id, ordinal_: 1, visibility_: 'hidden', points_: 20 })
    ).rejects.toThrow()
  })

  it('removes a problem tests, submissions and results when the problem goes', async () => {
    const user = await insertUser()
    const problem = await insertProblem()

    const [test] = await db
      .insert(task__problem_test_)
      .values({ problem_id_: problem.id, ordinal_: 1, visibility_: 'hidden', points_: 10 })
      .returning()

    const [submission] = await db
      .insert(submission__submission_)
      .values({
        problem_id_: problem.id,
        user_id_: user.id,
        language_: 'cpp',
        source_code_: 'int main() {}'
      })
      .returning()

    await db.insert(submission__test_result_).values({
      submission_id_: submission.id,
      problem_test_id_: test.id,
      ordinal_: 1,
      visibility_: 'hidden',
      verdict_: 'wrong_answer',
      passed_: false
    })

    await db.delete(task__problem_).where(eq(task__problem_.id, problem.id))

    expect(
      await db.select().from(task__problem_test_).where(eq(task__problem_test_.id, test.id))
    ).toHaveLength(0)
    expect(
      await db
        .select()
        .from(submission__submission_)
        .where(eq(submission__submission_.id, submission.id))
    ).toHaveLength(0)
    expect(
      await db
        .select()
        .from(submission__test_result_)
        .where(eq(submission__test_result_.submission_id_, submission.id))
    ).toHaveLength(0)
  })

  it('refuses a submission pointing at a user that does not exist', async () => {
    const problem = await insertProblem()
    const user = await insertUser()

    await db.delete(account__user_).where(eq(account__user_.id, user.id))
    createdUserIds.splice(createdUserIds.indexOf(user.id), 1)

    await expect(
      db.insert(submission__submission_).values({
        problem_id_: problem.id,
        user_id_: user.id,
        language_: 'python',
        source_code_: 'pass'
      })
    ).rejects.toThrow()
  })
})
