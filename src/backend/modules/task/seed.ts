import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type Database, db, type Transaction } from '@backend/database/db'
import {
  SUBMISSION_LANGUAGES,
  type SubmissionLanguage,
  task__problem_,
  task__problem_test_
} from '@backend/modules/task/schema'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { z } from 'zod'

const DEFAULT_PROBLEM_PACKAGES_PATH = fileURLToPath(
  new URL('../../../../problems', import.meta.url)
)

/**
 * What a package may call each language we can actually run. Anything else a
 * package offers (Java, Rust, Go) is dropped: we have no sandbox for it.
 */
const LANGUAGE_ALIASES: Record<string, SubmissionLanguage> = {
  python: 'python',
  python3: 'python',
  py: 'python',
  cpp: 'cpp',
  'c++': 'cpp',
  cc: 'cpp'
}

const problemPackageSchema = z.object({
  id: z.string().optional(),
  slug: z.string().optional(),
  code: z.string(),
  title: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  rating: z.number().optional(),
  tags: z.array(z.string()),
  kind: z.string(),
  languages: z.array(z.string()),
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
      output: z.string().nullable().optional(),
      explanation: z.string().nullable().optional()
    })
  ),
  limits: z.object({
    timeLimitMs: z.number(),
    memoryLimitMb: z.number()
  }),
  checker: z.object({
    type: z.enum(['token', 'custom', 'grader']),
    path: z.string().nullable().optional()
  }),
  tests: z.object({
    dir: z.string()
  })
})

type ProblemPackage = z.infer<typeof problemPackageSchema>

type HiddenTest = {
  inputMember: string
  /** Null for an interactive problem: its grader decides, so there is nothing to compare. */
  outputMember: string | null
}

export function getProblemPackagesPath(): string {
  const configuredPath = process.env.PROBLEM_PACKAGES_PATH

  if (!configuredPath) {
    return DEFAULT_PROBLEM_PACKAGES_PATH
  }

  return resolve(configuredPath)
}

/** Every directory under `problems/` that carries a `problem.json`. */
async function listPackageDirectories(packagesPath: string): Promise<string[]> {
  const members = await readdir(packagesPath, { withFileTypes: true })
  const directoryNames = members
    .filter(member => member.isDirectory())
    .map(member => member.name)
    .sort((left, right) => left.localeCompare(right))
  const withManifest: string[] = []

  for (const directoryName of directoryNames) {
    const manifest = await readFile(
      join(packagesPath, directoryName, 'problem.json'),
      'utf8'
    ).catch(() => null)

    if (manifest !== null) {
      withManifest.push(directoryName)
    }
  }

  return withManifest
}

async function readProblemPackage(problemDirectoryPath: string): Promise<ProblemPackage> {
  const problemJsonPath = join(problemDirectoryPath, 'problem.json')
  const fileContents = await readFile(problemJsonPath, 'utf8')

  return problemPackageSchema.parse(JSON.parse(fileContents))
}

/** The whole `statement.md`, or null when the package ships without one. */
async function readStatementMarkdown(problemDirectoryPath: string): Promise<string | null> {
  return readFile(join(problemDirectoryPath, 'statement.md'), 'utf8').catch(() => null)
}

/**
 * The languages the package offers, kept to the ones we can run and always in the
 * same order, so two packages that accept the same pair read the same way.
 */
function resolveLanguages(
  problemPackage: ProblemPackage,
  packageDirectory: string
): SubmissionLanguage[] {
  const offered = new Set<SubmissionLanguage>()

  for (const language of problemPackage.languages) {
    const known = LANGUAGE_ALIASES[language.trim().toLowerCase()]

    if (known) {
      offered.add(known)
    }
  }

  const languages = SUBMISSION_LANGUAGES.filter(language => offered.has(language))

  if (languages.length === 0) {
    throw new Error(`Problem package ${packageDirectory} offers no language we can run`)
  }

  return languages
}

/** An interactive problem is judged by its own grader, so no test carries an expected file. */
function expectsExpectedOutput(problemPackage: ProblemPackage): boolean {
  return problemPackage.checker.type !== 'grader' && problemPackage.io.mode !== 'interactive'
}

async function listHiddenTests(
  problemDirectoryPath: string,
  problemPackage: ProblemPackage,
  packageDirectory: string
): Promise<HiddenTest[]> {
  const testsDirectoryPath = join(problemDirectoryPath, problemPackage.tests.dir)
  const members = await readdir(testsDirectoryPath, { withFileTypes: true })
  const memberNames = new Set(members.filter(member => member.isFile()).map(member => member.name))
  const inputMembers = members
    .filter(member => member.isFile() && member.name.endsWith('.in'))
    .map(member => member.name)
    .sort((left, right) => left.localeCompare(right))
  const needsExpectedOutput = expectsExpectedOutput(problemPackage)

  return inputMembers.map(inputMember => {
    const outputMember = inputMember.replace(/\.in$/, '.out')

    if (!memberNames.has(outputMember)) {
      if (needsExpectedOutput) {
        throw new Error(`Missing hidden output file for ${packageDirectory}/${inputMember}`)
      }

      return { inputMember, outputMember: null }
    }

    return { inputMember, outputMember }
  })
}

async function insertProblemPackage(
  transaction: Transaction,
  packageDirectory: string
): Promise<void> {
  const problemDirectoryPath = join(getProblemPackagesPath(), packageDirectory)
  const problemPackage = await readProblemPackage(problemDirectoryPath)
  const slug = problemPackage.slug ?? problemPackage.id ?? packageDirectory
  const hiddenTests = await listHiddenTests(problemDirectoryPath, problemPackage, packageDirectory)

  const [problem] = await transaction
    .insert(task__problem_)
    .values({
      slug_: slug,
      code_: problemPackage.code,
      title_: problemPackage.title,
      statement_: problemPackage.statement.description,
      statement_markdown_: await readStatementMarkdown(problemDirectoryPath),
      statement_input_: problemPackage.statement.input ?? null,
      statement_output_: problemPackage.statement.output ?? null,
      statement_notes_: problemPackage.statement.notes ?? null,
      difficulty_: problemPackage.difficulty,
      rating_: problemPackage.rating ?? null,
      tags_: problemPackage.tags,
      kind_: problemPackage.kind,
      io_mode_: problemPackage.io.mode,
      languages_: resolveLanguages(problemPackage, packageDirectory),
      time_limit_ms_: problemPackage.limits.timeLimitMs,
      memory_limit_mb_: problemPackage.limits.memoryLimitMb,
      checker_type_: problemPackage.checker.type,
      checker_path_: problemPackage.checker.path ?? null,
      package_dir_: packageDirectory,
      is_published_: true
    })
    .returning({ id: task__problem_.id })

  await transaction.insert(task__problem_test_).values([
    // Samples are shown on the problem page, so they live in the database and score nothing.
    ...problemPackage.samples.map((sample, index) => ({
      problem_id_: problem.id,
      visibility_: 'public' as const,
      ordinal_: index + 1,
      input_: sample.input,
      expected_output_: sample.output ?? null,
      explanation_: sample.explanation ?? null,
      points_: 0
    })),
    // Hidden tests stay on the checkers' disks; only their file names are stored.
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

/**
 * A problem seeded before statements were kept as Markdown has none. It gets the
 * one its package ships with, so every problem page reads the same way. Nothing
 * else about an existing problem is touched.
 */
async function backfillStatementMarkdown(
  transaction: Transaction,
  problemId: string,
  packageDirectory: string
): Promise<void> {
  const markdown = await readStatementMarkdown(join(getProblemPackagesPath(), packageDirectory))

  if (markdown === null) {
    return
  }

  await transaction
    .update(task__problem_)
    .set({ statement_markdown_: markdown })
    .where(and(eq(task__problem_.id, problemId), isNull(task__problem_.statement_markdown_)))
}

/**
 * Puts every shipped problem package into the database once. A problem that is
 * already there is left exactly as it is - re-reading a changed package is not
 * this seeder's job.
 */
export async function seedTaskProblems(database: Database = db): Promise<void> {
  const packagesPath = getProblemPackagesPath()
  const packageDirectories = await listPackageDirectories(packagesPath)

  if (packageDirectories.length === 0) {
    return
  }

  await database.transaction(async transaction => {
    const seeded = await transaction
      .select({
        id: task__problem_.id,
        packageDir: task__problem_.package_dir_,
        statementMarkdown: task__problem_.statement_markdown_
      })
      .from(task__problem_)
      .where(inArray(task__problem_.package_dir_, packageDirectories))
    const seededDirectories = new Set(seeded.map(row => row.packageDir))

    for (const packageDirectory of packageDirectories) {
      if (seededDirectories.has(packageDirectory)) {
        continue
      }

      await insertProblemPackage(transaction, packageDirectory)
    }

    for (const problem of seeded) {
      if (problem.statementMarkdown === null) {
        await backfillStatementMarkdown(transaction, problem.id, problem.packageDir)
      }
    }
  })
}
