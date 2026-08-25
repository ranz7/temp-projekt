import { appRouter } from '@backend/appRouter'
import { db } from '@backend/database/db'
import { account__user_ } from '@backend/modules/account/schema'
import { type SubmissionStatus, submission__submission_ } from '@backend/modules/submission/schema'
import { type SubmissionLanguage, task__problem_ } from '@backend/modules/task/schema'
import { createCallerFactory, createTRPCContext } from '@backend/trpc'
import { TRPCError } from '@trpc/server'
import { eq, inArray } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

const createCaller = createCallerFactory(appRouter)

async function anonymousCaller() {
  return createCaller(await createTRPCContext({ headers: new Headers() }))
}

const createdUserIds: string[] = []
const createdProblemIds: string[] = []
let rowCounter = 0

function nextSuffix(): string {
  rowCounter += 1
  return `${Date.now()}-${rowCounter}`
}

async function insertUser(label: string): Promise<{ id: string; username: string }> {
  const username = `itest-ranking-${label}-${nextSuffix()}`
  const [user] = await db.insert(account__user_).values({ username_: username }).returning()
  createdUserIds.push(user.id)

  return { id: user.id, username }
}

async function insertProblem(options?: { isPublished?: boolean }): Promise<{
  id: string
  slug: string
}> {
  const slug = `itest-ranking-${nextSuffix()}`
  const [problem] = await db
    .insert(task__problem_)
    .values({
      slug_: slug,
      code_: '4A',
      title_: 'Watermelon',
      statement_: 'Split the watermelon into two even parts.',
      difficulty_: 'easy',
      rating_: 800,
      tags_: ['math'],
      languages_: ['python', 'cpp'],
      time_limit_ms_: 1000,
      memory_limit_mb_: 64,
      package_dir_: 'cf-4-A',
      is_published_: options?.isPublished ?? true
    })
    .returning()
  createdProblemIds.push(problem.id)

  return { id: problem.id, slug }
}

async function insertSubmission(values: {
  problemId: string
  userId: string
  status: SubmissionStatus
  createdAt: Date
  language?: SubmissionLanguage
  score?: number
}): Promise<string> {
  const [submission] = await db
    .insert(submission__submission_)
    .values({
      problem_id_: values.problemId,
      user_id_: values.userId,
      language_: values.language ?? 'python',
      source_code_: 'print("YES")',
      status_: values.status,
      score_: values.score ?? null,
      created_at_: values.createdAt
    })
    .returning({ id: submission__submission_.id })

  return submission.id
}

/** Fixed points in time, so an ordering assertion can never be a coin flip. */
function at(minutes: number): Date {
  return new Date(Date.UTC(2020, 0, 1, 0, minutes, 0))
}

afterEach(async () => {
  const problemIds = createdProblemIds.splice(0)
  const userIds = createdUserIds.splice(0)

  if (problemIds.length > 0) {
    await db.delete(task__problem_).where(inArray(task__problem_.id, problemIds))
  }
  for (const userId of userIds) {
    await db.delete(account__user_).where(eq(account__user_.id, userId))
  }
})

async function globalRankingFor(userIds: string[]) {
  const trpc = await anonymousCaller()
  const ranking = await trpc.ranking.getGlobalRanking({ limit: 200 })

  // Other suites share the database; only the people this test made matter.
  return ranking.filter(row => userIds.includes(row.userId))
}

describe('ranking.getGlobalRanking', () => {
  it('leaves out anyone without an accepted submission', async () => {
    const silent = await insertUser('silent')
    const failing = await insertUser('failing')
    const solver = await insertUser('solver')
    const problem = await insertProblem()

    await insertSubmission({
      problemId: problem.id,
      userId: failing.id,
      status: 'wrong_answer',
      createdAt: at(1)
    })
    await insertSubmission({
      problemId: problem.id,
      userId: solver.id,
      status: 'accepted',
      createdAt: at(2)
    })

    const rows = await globalRankingFor([silent.id, failing.id, solver.id])

    expect(rows.map(row => row.userId)).toEqual([solver.id])
    expect(rows[0].username).toBe(solver.username)
    expect(rows[0].solvedCount).toBe(1)
  })

  it('counts one problem once however many times it was solved', async () => {
    const user = await insertUser('twice')
    const problem = await insertProblem()

    await insertSubmission({
      problemId: problem.id,
      userId: user.id,
      status: 'accepted',
      createdAt: at(1)
    })
    await insertSubmission({
      problemId: problem.id,
      userId: user.id,
      status: 'accepted',
      createdAt: at(5)
    })

    const rows = await globalRankingFor([user.id])

    expect(rows).toHaveLength(1)
    expect(rows[0].solvedCount).toBe(1)
  })

  it('puts someone who solved two problems above someone who solved one', async () => {
    const one = await insertUser('one')
    const two = await insertUser('two')
    const first = await insertProblem()
    const second = await insertProblem()

    // The weaker solver goes first in time, so only the count can decide.
    await insertSubmission({
      problemId: first.id,
      userId: one.id,
      status: 'accepted',
      createdAt: at(1)
    })
    await insertSubmission({
      problemId: first.id,
      userId: two.id,
      status: 'accepted',
      createdAt: at(10)
    })
    await insertSubmission({
      problemId: second.id,
      userId: two.id,
      status: 'accepted',
      createdAt: at(11)
    })

    const rows = await globalRankingFor([one.id, two.id])

    expect(rows.map(row => [row.rank, row.userId, row.solvedCount])).toEqual([
      [rows[0].rank, two.id, 2],
      [rows[1].rank, one.id, 1]
    ])
    expect(rows[0].rank).toBeLessThan(rows[1].rank)
  })

  it('settles an equal count by who reached it first', async () => {
    const early = await insertUser('early')
    const late = await insertUser('late')
    const first = await insertProblem()
    const second = await insertProblem()

    // `late` started earlier but finished later; only the second solve counts.
    await insertSubmission({
      problemId: first.id,
      userId: late.id,
      status: 'accepted',
      createdAt: at(1)
    })
    await insertSubmission({
      problemId: first.id,
      userId: early.id,
      status: 'accepted',
      createdAt: at(2)
    })
    await insertSubmission({
      problemId: second.id,
      userId: early.id,
      status: 'accepted',
      createdAt: at(3)
    })
    await insertSubmission({
      problemId: second.id,
      userId: late.id,
      status: 'accepted',
      createdAt: at(4)
    })

    const rows = await globalRankingFor([early.id, late.id])

    expect(rows.map(row => row.userId)).toEqual([early.id, late.id])
    expect(rows.map(row => row.solvedCount)).toEqual([2, 2])
  })

  it('numbers the returned rows from 1 upwards', async () => {
    const trpc = await anonymousCaller()
    const user = await insertUser('numbered')
    const problem = await insertProblem()

    await insertSubmission({
      problemId: problem.id,
      userId: user.id,
      status: 'accepted',
      createdAt: at(1)
    })

    const ranking = await trpc.ranking.getGlobalRanking()

    expect(ranking.length).toBeGreaterThan(0)
    expect(ranking.map(row => row.rank)).toEqual(ranking.map((_row, index) => index + 1))
  })
})

describe('ranking.getProblemRanking', () => {
  it('lists each person once, earliest solver first, on their first accepted submission', async () => {
    const trpc = await anonymousCaller()
    const early = await insertUser('p-early')
    const late = await insertUser('p-late')
    const problem = await insertProblem()

    await insertSubmission({
      problemId: problem.id,
      userId: early.id,
      status: 'wrong_answer',
      createdAt: at(1)
    })
    const earlyFirstAccepted = await insertSubmission({
      problemId: problem.id,
      userId: early.id,
      status: 'accepted',
      createdAt: at(2),
      language: 'python',
      score: 30
    })
    await insertSubmission({
      problemId: problem.id,
      userId: early.id,
      status: 'accepted',
      createdAt: at(9),
      language: 'cpp',
      score: 40
    })
    const lateFirstAccepted = await insertSubmission({
      problemId: problem.id,
      userId: late.id,
      status: 'accepted',
      createdAt: at(5),
      language: 'cpp',
      score: 40
    })

    const rows = await trpc.ranking.getProblemRanking({ slug: problem.slug })

    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({
      rank: 1,
      userId: early.id,
      username: early.username,
      submissionId: earlyFirstAccepted,
      language: 'python',
      solvedAt: at(2),
      score: 30
    })
    expect(rows[1]).toEqual({
      rank: 2,
      userId: late.id,
      username: late.username,
      submissionId: lateFirstAccepted,
      language: 'cpp',
      solvedAt: at(5),
      score: 40
    })
  })

  it('returns nothing for a problem nobody solved', async () => {
    const trpc = await anonymousCaller()
    const user = await insertUser('p-unsolved')
    const problem = await insertProblem()

    await insertSubmission({
      problemId: problem.id,
      userId: user.id,
      status: 'time_limit',
      createdAt: at(1)
    })

    expect(await trpc.ranking.getProblemRanking({ slug: problem.slug })).toEqual([])
  })

  it('refuses a slug no problem answers to', async () => {
    const trpc = await anonymousCaller()

    await expect(
      trpc.ranking.getProblemRanking({ slug: `itest-ranking-missing-${nextSuffix()}` })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('refuses a problem that is not published', async () => {
    const trpc = await anonymousCaller()
    const problem = await insertProblem({ isPublished: false })

    const error = await trpc.ranking
      .getProblemRanking({ slug: problem.slug })
      .then(() => null)
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(TRPCError)
    expect(error).toMatchObject({ code: 'NOT_FOUND' })
  })
})
