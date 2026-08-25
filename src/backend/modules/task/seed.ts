import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type Database, db, type Transaction } from '@backend/database/db'
import {
  type SubmissionLanguage,
  task__problem_,
  task__problem_test_
} from '@backend/modules/task/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const SEEDED_PROBLEM_SLUG = 'cf-4-A'
const DEFAULT_PROBLEM_PACKAGES_PATH = fileURLToPath(
  new URL('../../../../problems', import.meta.url)
)
const ALLOWED_LANGUAGES: SubmissionLanguage[] = ['python', 'cpp']

const problemPackageSchema = z.object({
  code: z.string(),
  title: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  rating: z.number().optional(),
  tags: z.array(z.string()),
  kind: z.string(),
  io: z.object({
    mode: z.string()
  }),
  statement: z.object({
    description: z.string(),
    input: z.string().nullable().optional(),
    output: z.string().nullable().optional(),
    notes: z.string().nullable().optional()
  }),
  samples: z.array(
    z.object({
      input: z.string(),
      output: z.string(),
      explanation: z.string().nullable().optional()
    })
  ),
  limits: z.object({
    timeLimitMs: z.number(),
    memoryLimitMb: z.number()
  }),
  checker: z.object({
    type: z.enum(['token', 'custom']),
    path: z.string().nullable().optional()
  }),
  tests: z.object({
    dir: z.string()
  })
})

type ProblemPackage = z.infer<typeof problemPackageSchema>

type HiddenTest = {
  inputMember: string
  outputMember: string
}

export function getProblemPackagesPath(): string {
  const configuredPath = process.env.PROBLEM_PACKAGES_PATH

  if (!configuredPath) {
    return DEFAULT_PROBLEM_PACKAGES_PATH
  }

  return resolve(configuredPath)
}

async function readProblemPackage(problemDirectoryPath: string): Promise<ProblemPackage> {
  const problemJsonPath = join(problemDirectoryPath, 'problem.json')
  const fileContents = await readFile(problemJsonPath, 'utf8')

  return problemPackageSchema.parse(JSON.parse(fileContents))
}

async function listHiddenTests(
  problemDirectoryPath: string,
  testsDirectoryName: string
): Promise<HiddenTest[]> {
  const testsDirectoryPath = join(problemDirectoryPath, testsDirectoryName)
  const members = await readdir(testsDirectoryPath, { withFileTypes: true })
  const memberNames = new Set(members.filter(member => member.isFile()).map(member => member.name))
  const inputMembers = members
    .filter(member => member.isFile() && member.name.endsWith('.in'))
    .map(member => member.name)
    .sort((left, right) => left.localeCompare(right))

  return inputMembers.map(inputMember => {
    const outputMember = inputMember.replace(/\.in$/, '.out')

    if (!memberNames.has(outputMember)) {
      throw new Error(`Missing hidden output file for ${inputMember}`)
    }

    return {
      inputMember,
      outputMember
    }
  })
}

async function insertSeededProblem(transaction: Transaction): Promise<void> {
  const existingProblem = await transaction
    .select({ id: task__problem_.id })
    .from(task__problem_)
    .where(eq(task__problem_.slug_, SEEDED_PROBLEM_SLUG))
    .limit(1)

  if (existingProblem.length > 0) {
    return
  }

  const problemDirectoryPath = join(getProblemPackagesPath(), SEEDED_PROBLEM_SLUG)
  const problemPackage = await readProblemPackage(problemDirectoryPath)
  const hiddenTests = await listHiddenTests(problemDirectoryPath, problemPackage.tests.dir)

  const [problem] = await transaction
    .insert(task__problem_)
    .values({
      slug_: SEEDED_PROBLEM_SLUG,
      code_: problemPackage.code,
      title_: problemPackage.title,
      statement_: problemPackage.statement.description,
      statement_input_: problemPackage.statement.input ?? null,
      statement_output_: problemPackage.statement.output ?? null,
      statement_notes_: problemPackage.statement.notes ?? null,
      difficulty_: problemPackage.difficulty,
      rating_: problemPackage.rating ?? null,
      tags_: problemPackage.tags,
      kind_: problemPackage.kind,
      io_mode_: problemPackage.io.mode,
      languages_: ALLOWED_LANGUAGES,
      time_limit_ms_: problemPackage.limits.timeLimitMs,
      memory_limit_mb_: problemPackage.limits.memoryLimitMb,
      checker_type_: problemPackage.checker.type,
      checker_path_: problemPackage.checker.path ?? null,
      package_dir_: SEEDED_PROBLEM_SLUG,
      is_published_: true
    })
    .returning({ id: task__problem_.id })

  await transaction.insert(task__problem_test_).values([
    ...problemPackage.samples.map((sample, index) => ({
      problem_id_: problem.id,
      visibility_: 'public' as const,
      ordinal_: index + 1,
      input_: sample.input,
      expected_output_: sample.output,
      explanation_: sample.explanation ?? null,
      points_: 0
    })),
    ...hiddenTests.map((test, index) => ({
      problem_id_: problem.id,
      visibility_: 'hidden' as const,
      ordinal_: index + 1,
      input_member_: test.inputMember,
      output_member_: test.outputMember,
      points_: 1
    }))
  ])
}

export async function seedTaskProblems(database: Database = db): Promise<void> {
  await database.transaction(async transaction => {
    await insertSeededProblem(transaction)
  })
}
