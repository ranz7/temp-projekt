import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { appRouter } from '@backend/appRouter'
import { db } from '@backend/database/db'
import { task__problem_ } from '@backend/modules/task/schema'
import { getProblemPackagesPath, seedTaskProblems } from '@backend/modules/task/seed'
import { createCallerFactory, createTRPCContext } from '@backend/trpc'
import { like } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const createCaller = createCallerFactory(appRouter)

const SLUG_PREFIX = 'itest-getproblem-'
const UNPUBLISHED_SLUG = `${SLUG_PREFIX}hidden`
/** A problem that predates Markdown statements, so it has none. */
const NO_MARKDOWN_SLUG = `${SLUG_PREFIX}nomarkdown`
const SEEDED_PROBLEM_SLUG = 'cf-4-A'
const HIDDEN_TEST_COUNT = 20
/** A file name that exists only on the checkers' filesystem. It must never be in a response. */
const HIDDEN_TEST_FILE = '01.in'

async function caller() {
  const headers = new Headers()

  return createCaller(await createTRPCContext({ headers }))
}

async function removeTestProblems() {
  await db.delete(task__problem_).where(like(task__problem_.slug_, `${SLUG_PREFIX}%`))
}

beforeAll(async () => {
  await removeTestProblems()
  await seedTaskProblems(db)
  await db.insert(task__problem_).values({
    slug_: UNPUBLISHED_SLUG,
    code_: 'IGP-H1',
    title_: 'Itest Unpublished',
    statement_: 'Not published yet.',
    difficulty_: 'easy',
    tags_: [],
    kind_: 'stdio',
    io_mode_: 'stdio',
    languages_: ['python'],
    time_limit_ms_: 1000,
    memory_limit_mb_: 64,
    package_dir_: UNPUBLISHED_SLUG,
    is_published_: false
  })
  await db.insert(task__problem_).values({
    slug_: NO_MARKDOWN_SLUG,
    code_: 'IGP-N1',
    title_: 'Itest Without Markdown',
    statement_: 'Only the old sections.',
    statement_input_: 'One number.',
    statement_output_: 'One word.',
    difficulty_: 'easy',
    tags_: [],
    kind_: 'stdio',
    io_mode_: 'stdio',
    languages_: ['python'],
    time_limit_ms_: 1000,
    memory_limit_mb_: 64,
    package_dir_: NO_MARKDOWN_SLUG,
    is_published_: true
  })
})

afterAll(removeTestProblems)

describe('task.getProblem', () => {
  it('opens the shipped problem with its one public sample', async () => {
    const trpc = await caller()

    const problem = await trpc.task.getProblem({ slug: SEEDED_PROBLEM_SLUG })

    expect(problem.slug).toBe(SEEDED_PROBLEM_SLUG)
    expect(problem.code).toBe('4A')
    expect(problem.title).toBe('Watermelon')
    expect(problem.difficulty).toBe('easy')
    expect(problem.rating).toBe(800)
    expect(problem.tags).toEqual(['brute force', 'math'])
    expect(problem.kind).toBe('stdio')
    expect(problem.ioMode).toBe('stdio')
    expect(problem.languages).toEqual(['python', 'cpp'])
    expect(problem.timeLimitMs).toBe(1000)
    expect(problem.memoryLimitMb).toBe(64)
    expect(problem.statement.length).toBeGreaterThan(0)
    expect(problem.statementInput).not.toBeNull()
    expect(problem.statementOutput).not.toBeNull()

    expect(problem.samples).toHaveLength(1)
    expect(problem.samples[0].ordinal).toBe(1)
    expect(problem.samples[0].input).toBe('8')
    expect(problem.samples[0].expectedOutput).toBe('YES')
  })

  it('reports how many hidden tests there are and nothing about them', async () => {
    const trpc = await caller()

    const problem = await trpc.task.getProblem({ slug: SEEDED_PROBLEM_SLUG })
    const serialised = JSON.stringify(problem)

    expect(problem.hiddenTestCount).toBe(HIDDEN_TEST_COUNT)
    expect(serialised).not.toContain(HIDDEN_TEST_FILE)
    expect(serialised).not.toContain('01.out')
    expect(serialised).not.toContain('inputMember')
    expect(serialised).not.toContain('input_member_')
    expect(serialised).not.toContain('outputMember')
    expect(serialised).not.toContain('output_member_')
    // The only test data anywhere in the answer belongs to the public sample.
    expect(serialised.split('"expectedOutput"')).toHaveLength(2)
  })

  it('hands the page the whole statement, code fences and all', async () => {
    const trpc = await caller()
    const statementMarkdown = await readFile(
      join(getProblemPackagesPath(), 'combo', 'statement.md'),
      'utf8'
    )
    const [, fencedCodeBlock] = statementMarkdown.split('```')

    const problem = await trpc.task.getProblem({ slug: 'combo' })

    expect(fencedCodeBlock).toContain('guess_sequence')
    expect(problem.statementMarkdown).toBe(statementMarkdown)
    expect(problem.statementMarkdown ?? '').toContain(`\`\`\`${fencedCodeBlock}\`\`\``)
  })

  it('says so plainly when a problem has no Markdown statement', async () => {
    const trpc = await caller()

    const problem = await trpc.task.getProblem({ slug: NO_MARKDOWN_SLUG })

    expect(problem.statementMarkdown).toBeNull()
    // The page falls back to these, so they still travel.
    expect(problem.statement).toBe('Only the old sections.')
    expect(problem.statementInput).toBe('One number.')
  })

  it('refuses a slug nobody has', async () => {
    const trpc = await caller()

    await expect(trpc.task.getProblem({ slug: 'no-such-problem' })).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })
  })

  it('refuses a problem that is not published', async () => {
    const trpc = await caller()

    await expect(trpc.task.getProblem({ slug: UNPUBLISHED_SLUG })).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })
  })
})
