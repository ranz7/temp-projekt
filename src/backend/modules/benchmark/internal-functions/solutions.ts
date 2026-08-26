import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { SubmissionLanguage } from '@backend/modules/task/schema'

/** Where the solutions sit in a checkout, relative to the working directory. */
const DEFAULT_SOLUTIONS_DIRECTORY = 'src/backend/modules/benchmark/solutions'

/**
 * The directory holding the shipped reference solutions.
 *
 * `BENCHMARK_SOLUTIONS_PATH` names it, exactly as `PROBLEM_PACKAGES_PATH` names the
 * problem packages. Unset, it is this path under the working directory: a checkout,
 * the test suite and the production image all have the eight files exactly there, the
 * image because the build traces them in beside `server.js`.
 *
 * It is deliberately not derived from this file's own location: the bundler reads that
 * as a module reference, fails to resolve it, and the whole app stops building.
 */
export function getBenchmarkSolutionsPath(): string {
  const configuredPath = process.env.BENCHMARK_SOLUTIONS_PATH

  if (configuredPath === undefined || configuredPath.trim() === '') {
    return resolve(process.cwd(), DEFAULT_SOLUTIONS_DIRECTORY)
  }

  return resolve(configuredPath)
}

/** One correct and one deliberately wrong solution for a problem the panel can batch. */
export type BenchmarkSolutionSet = {
  /** The problem these solve, as `task__problem_.slug_` spells it. */
  problemSlug: string
  /** A language the problem accepts: Python everywhere it is allowed, C++ for `combo`. */
  language: SubmissionLanguage
  correctFileName: string
  wrongFileName: string
}

/**
 * Every problem the panel can send a batch for. A problem missing from this list has
 * no shipped solutions, and the panel says so rather than sending an empty batch.
 */
export const BENCHMARK_SOLUTION_SETS: readonly BenchmarkSolutionSet[] = [
  {
    problemSlug: 'cf-4-A',
    language: 'python',
    correctFileName: 'watermelon-correct.py',
    wrongFileName: 'watermelon-wrong.py'
  },
  {
    problemSlug: 'minimizing-coins',
    language: 'python',
    correctFileName: 'minimizing-coins-correct.py',
    wrongFileName: 'minimizing-coins-wrong.py'
  },
  {
    problemSlug: 'rl-nearest-pairs',
    language: 'python',
    correctFileName: 'rl-nearest-pairs-correct.py',
    wrongFileName: 'rl-nearest-pairs-wrong.py'
  },
  {
    problemSlug: 'combo',
    language: 'cpp',
    correctFileName: 'combo-correct.cpp',
    wrongFileName: 'combo-wrong.cpp'
  }
]

export function findBenchmarkSolutionSet(problemSlug: string): BenchmarkSolutionSet | null {
  return BENCHMARK_SOLUTION_SETS.find(set => set.problemSlug === problemSlug) ?? null
}

export function getBenchmarkSolutionPath(fileName: string): string {
  // The solutions are data read at run time, not modules. Without this the bundler
  // traces the whole repository into the standalone output, which is both wrong and
  // enormous.
  return join(/* turbopackIgnore: true */ getBenchmarkSolutionsPath(), fileName)
}

/** The two source files of one problem, read once and reused for the whole batch. */
export type BenchmarkSolutionPair = {
  correct: string
  wrong: string
}

export async function readBenchmarkSolutionPair(
  set: BenchmarkSolutionSet
): Promise<BenchmarkSolutionPair> {
  const [correct, wrong] = await Promise.all([
    readSolutionFile(set.correctFileName),
    readSolutionFile(set.wrongFileName)
  ])

  return { correct, wrong }
}

async function readSolutionFile(fileName: string): Promise<string> {
  const path = getBenchmarkSolutionPath(fileName)

  return readFile(/* turbopackIgnore: true */ path, 'utf8').catch(() => {
    throw new Error(
      `The reference solution ${fileName} is not at ${path}. Point BENCHMARK_SOLUTIONS_PATH at the directory holding it.`
    )
  })
}
