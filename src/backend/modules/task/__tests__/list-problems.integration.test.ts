import { appRouter } from '@backend/appRouter'
import { db } from '@backend/database/db'
import { account__user_ } from '@backend/modules/account/schema'
import { submission__submission_ } from '@backend/modules/submission/schema'
import { task__problem_ } from '@backend/modules/task/schema'
import { seedTaskProblems } from '@backend/modules/task/seed'
import { createCallerFactory, createTRPCContext } from '@backend/trpc'
import { like } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const createCaller = createCallerFactory(appRouter)

const SLUG_PREFIX = 'itest-task-'
const USERNAME_PREFIX = 'itest-task-'
const SEEDED_PROBLEM_SLUG = 'cf-4-A'

/** Only these three carry `itestlist`, so a search for it scopes the list to them. */
const LIST_SEARCH = 'itestlist'
const SOLVE_SEARCH = 'itestsolve'

async function caller() {
  const headers = new Headers()

  return createCaller(await createTRPCContext({ headers }))
}

async function removeTestRows() {
  // Submissions hang off problems by a cascading foreign key, so they go first.
  await db.delete(task__problem_).where(like(task__problem_.slug_, `${SLUG_PREFIX}%`))
  await db.delete(account__user_).where(like(account__user_.username_, `${USERNAME_PREFIX}%`))
}

async function insertTestProblems() {
  await db.insert(task__problem_).values([
    {
      slug_: `${SLUG_PREFIX}l1`,
      code_: 'ITL-A1',
      title_: 'Zeta Alpha Itestlist',
      statement_: 'Alpha statement.',
      difficulty_: 'easy',
      rating_: 900,
      tags_: ['itest-tag-x', 'math'],
      kind_: 'stdio',
      io_mode_: 'stdio',
      languages_: ['python'],
      time_limit_ms_: 1000,
      memory_limit_mb_: 64,
      package_dir_: `${SLUG_PREFIX}l1`,
      is_published_: true
    },
    {
      slug_: `${SLUG_PREFIX}l2`,
      code_: 'ITL-B2',
      title_: 'Zeta Bravo Itestlist',
      statement_: 'Bravo statement.',
      difficulty_: 'medium',
      rating_: 1200,
      tags_: ['itest-tag-y'],
      kind_: 'interactive',
      io_mode_: 'stdio',
      languages_: ['python', 'cpp'],
      time_limit_ms_: 2000,
      memory_limit_mb_: 128,
      package_dir_: `${SLUG_PREFIX}l2`,
      is_published_: true
    },
    {
      slug_: `${SLUG_PREFIX}l3`,
      code_: 'ITL-C3',
      title_: 'Zeta Charlie Itestlist',
      statement_: 'Charlie statement.',
      difficulty_: 'hard',
      rating_: 1500,
      tags_: ['itest-tag-x'],
      kind_: 'stdio',
      io_mode_: 'stdio',
      languages_: ['cpp'],
      time_limit_ms_: 3000,
      memory_limit_mb_: 256,
      package_dir_: `${SLUG_PREFIX}l3`,
      is_published_: true
    },
    {
      slug_: `${SLUG_PREFIX}l4`,
      code_: 'ITL-D4',
      title_: 'Zeta Delta Itestlist',
      statement_: 'Delta statement, not published.',
      difficulty_: 'easy',
      rating_: 800,
      tags_: ['itest-tag-x'],
      kind_: 'stdio',
      io_mode_: 'stdio',
      languages_: ['python'],
      time_limit_ms_: 1000,
      memory_limit_mb_: 64,
      package_dir_: `${SLUG_PREFIX}l4`,
      is_published_: false
    },
    {
      slug_: `${SLUG_PREFIX}s9`,
      code_: 'ITS-S9',
      title_: 'Itestsolve Problem',
      statement_: 'Solve count statement.',
      difficulty_: 'easy',
      rating_: 800,
      tags_: ['itest-tag-z'],
      kind_: 'stdio',
      io_mode_: 'stdio',
      languages_: ['python'],
      time_limit_ms_: 1000,
      memory_limit_mb_: 64,
      package_dir_: `${SLUG_PREFIX}s9`,
      is_published_: true
    }
  ])
}

beforeAll(async () => {
  await removeTestRows()
  await seedTaskProblems(db)
  await insertTestProblems()
})

afterAll(removeTestRows)

describe('task.listProblems', () => {
  it('returns the shipped Watermelon with its real tags and limits', async () => {
    const trpc = await caller()

    const result = await trpc.task.listProblems({ search: 'watermelon' })
    const watermelon = result.problems.find(problem => problem.slug === SEEDED_PROBLEM_SLUG)

    expect(watermelon).toBeDefined()
    expect(watermelon?.code).toBe('4A')
    expect(watermelon?.title).toBe('Watermelon')
    expect(watermelon?.difficulty).toBe('easy')
    expect(watermelon?.rating).toBe(800)
    expect(watermelon?.tags).toEqual(['brute force', 'math'])
    expect(watermelon?.kind).toBe('stdio')
    expect(watermelon?.timeLimitMs).toBe(1000)
    expect(watermelon?.memoryLimitMb).toBe(64)
    expect(typeof watermelon?.solveCount).toBe('number')
  })

  it('leaves an unpublished problem out of the list', async () => {
    const trpc = await caller()

    const result = await trpc.task.listProblems({ search: LIST_SEARCH })

    expect(result.problems.map(problem => problem.slug)).not.toContain(`${SLUG_PREFIX}l4`)
    expect(result.total).toBe(3)
  })

  it('matches part of a title whatever the capitals', async () => {
    const trpc = await caller()

    const result = await trpc.task.listProblems({ search: 'ALPHA ITESTLIST' })

    expect(result.problems.map(problem => problem.slug)).toEqual([`${SLUG_PREFIX}l1`])
  })

  it('matches part of a code whatever the capitals', async () => {
    const trpc = await caller()

    const result = await trpc.task.listProblems({ search: 'itl-b' })

    expect(result.problems.map(problem => problem.slug)).toEqual([`${SLUG_PREFIX}l2`])
  })

  it('narrows the list by difficulty', async () => {
    const trpc = await caller()

    const result = await trpc.task.listProblems({ search: LIST_SEARCH, difficulty: 'medium' })

    expect(result.total).toBe(1)
    expect(result.problems.map(problem => problem.slug)).toEqual([`${SLUG_PREFIX}l2`])
  })

  it('narrows the list by tag', async () => {
    const trpc = await caller()

    const result = await trpc.task.listProblems({ search: LIST_SEARCH, tag: 'itest-tag-x' })

    expect(result.total).toBe(2)
    expect(result.problems.map(problem => problem.slug)).toEqual([
      `${SLUG_PREFIX}l1`,
      `${SLUG_PREFIX}l3`
    ])
  })

  it('narrows the list by kind', async () => {
    const trpc = await caller()

    const result = await trpc.task.listProblems({ search: LIST_SEARCH, kind: 'interactive' })

    expect(result.total).toBe(1)
    expect(result.problems.map(problem => problem.slug)).toEqual([`${SLUG_PREFIX}l2`])
  })

  it('puts all three on the first page and leaves the second empty', async () => {
    const trpc = await caller()

    const firstPage = await trpc.task.listProblems({
      search: LIST_SEARCH,
      pageSize: 25,
      page: 1
    })
    const secondPage = await trpc.task.listProblems({
      search: LIST_SEARCH,
      pageSize: 25,
      page: 2
    })

    expect(firstPage.problems).toHaveLength(3)
    expect(firstPage.total).toBe(3)
    expect(firstPage.page).toBe(1)
    expect(firstPage.pageSize).toBe(25)
    expect(secondPage.problems).toHaveLength(0)
    expect(secondPage.total).toBe(3)
  })

  it('sorts by title in opposite orders', async () => {
    const trpc = await caller()

    const ascending = await trpc.task.listProblems({
      search: LIST_SEARCH,
      sort: 'title',
      order: 'asc'
    })
    const descending = await trpc.task.listProblems({
      search: LIST_SEARCH,
      sort: 'title',
      order: 'desc'
    })

    expect(ascending.problems.map(problem => problem.title)).toEqual([
      'Zeta Alpha Itestlist',
      'Zeta Bravo Itestlist',
      'Zeta Charlie Itestlist'
    ])
    expect(descending.problems.map(problem => problem.title)).toEqual(
      [...ascending.problems.map(problem => problem.title)].reverse()
    )
  })

  it('sorts difficulty easy, medium, hard rather than alphabetically', async () => {
    const trpc = await caller()

    const result = await trpc.task.listProblems({
      search: LIST_SEARCH,
      sort: 'difficulty',
      order: 'asc'
    })

    expect(result.problems.map(problem => problem.difficulty)).toEqual(['easy', 'medium', 'hard'])
  })
})

describe('task.listProblems solve count', () => {
  async function solveCountOfTestProblem(): Promise<number> {
    const trpc = await caller()
    const result = await trpc.task.listProblems({ search: SOLVE_SEARCH })

    expect(result.problems).toHaveLength(1)

    return result.problems[0].solveCount
  }

  it('counts distinct people with an accepted solution', async () => {
    const [problem] = await db
      .select({ id: task__problem_.id })
      .from(task__problem_)
      .where(like(task__problem_.slug_, `${SLUG_PREFIX}s9`))

    const users = await db
      .insert(account__user_)
      .values([
        { username_: `${USERNAME_PREFIX}solve1` },
        { username_: `${USERNAME_PREFIX}solve2` },
        { username_: `${USERNAME_PREFIX}solve3` }
      ])
      .returning({ id: account__user_.id })

    expect(await solveCountOfTestProblem()).toBe(0)

    // The same person accepted twice is still one solver.
    await db.insert(submission__submission_).values([
      {
        problem_id_: problem.id,
        user_id_: users[0].id,
        language_: 'python',
        source_code_: 'print(1)',
        status_: 'accepted'
      },
      {
        problem_id_: problem.id,
        user_id_: users[0].id,
        language_: 'python',
        source_code_: 'print(2)',
        status_: 'accepted'
      }
    ])

    expect(await solveCountOfTestProblem()).toBe(1)

    // A wrong answer from somebody else does not make them a solver.
    await db.insert(submission__submission_).values({
      problem_id_: problem.id,
      user_id_: users[2].id,
      language_: 'python',
      source_code_: 'print(3)',
      status_: 'wrong_answer'
    })

    expect(await solveCountOfTestProblem()).toBe(1)

    // A second person accepted makes it two.
    await db.insert(submission__submission_).values({
      problem_id_: problem.id,
      user_id_: users[1].id,
      language_: 'python',
      source_code_: 'print(4)',
      status_: 'accepted'
    })

    expect(await solveCountOfTestProblem()).toBe(2)
  })
})
