import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { SubmissionLanguage } from '@backend/modules/task/schema'

/** Where the shipped reference solutions live. */
const SOLUTIONS_PATH = fileURLToPath(new URL('../solutions', import.meta.url))

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
  return `${SOLUTIONS_PATH}/${fileName}`
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
    readFile(getBenchmarkSolutionPath(set.correctFileName), 'utf8'),
    readFile(getBenchmarkSolutionPath(set.wrongFileName), 'utf8')
  ])

  return { correct, wrong }
}
