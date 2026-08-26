import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BENCHMARK_SOLUTION_SETS,
  type BenchmarkSolutionSet,
  getBenchmarkSolutionPath
} from '@backend/modules/benchmark/internal-functions/solutions'
import { describe, expect, it } from 'vitest'

// Read straight from the repository: the shipped packages are what a batch is judged
// against, and this test must not pull the database in behind a helper.
const PACKAGES_PATH = fileURLToPath(new URL('../../../../../problems', import.meta.url))
const RUN_TIMEOUT_MS = 60_000

/** The package directory each set solves. Only `cf-4-A` spells its slug differently. */
const PACKAGE_DIRECTORIES: Record<string, string> = {
  'cf-4-A': 'cf-4-A',
  'minimizing-coins': 'minimizing-coins',
  'rl-nearest-pairs': 'rl-nearest-pairs',
  combo: 'combo'
}

function hasTool(command: string): boolean {
  return spawnSync(command, ['--version'], { encoding: 'utf8' }).status === 0
}

function sampleInputPath(packageDirectory: string): string {
  return join(PACKAGES_PATH, packageDirectory, 'samples', '01.in')
}

function sampleOutputPath(packageDirectory: string): string {
  return join(PACKAGES_PATH, packageDirectory, 'samples', '01.out')
}

function tokens(text: string): string[] {
  return text.trim().split(/\s+/u).filter(Boolean)
}

function runPython(solutionPath: string, inputPath: string): string {
  const result = spawnSync('python3', [solutionPath], {
    input: readFileSync(inputPath),
    encoding: 'utf8',
    timeout: RUN_TIMEOUT_MS
  })

  expect(result.status, result.stderr ?? '').toBe(0)

  return result.stdout
}

/** True when the package's own checker accepts the answer. */
function runPackageChecker(packageDirectory: string, actual: string): boolean {
  const workingDirectory = mkdtempSync(join(tmpdir(), 'benchmark-checker-'))
  const actualPath = join(workingDirectory, 'actual.out')

  writeFileSync(actualPath, actual)

  try {
    const result = spawnSync(
      'python3',
      [
        join(PACKAGES_PATH, packageDirectory, 'checker', 'checker.py'),
        sampleInputPath(packageDirectory),
        sampleOutputPath(packageDirectory),
        actualPath
      ],
      { encoding: 'utf8', timeout: RUN_TIMEOUT_MS }
    )

    return result.stdout.trim() === '1'
  } finally {
    rmSync(workingDirectory, { recursive: true, force: true })
  }
}

/** Builds the submission together with `combo`'s grader and reports what it printed. */
function runComboGrader(solutionFileName: string): string {
  const workingDirectory = mkdtempSync(join(tmpdir(), 'benchmark-combo-'))
  const graderDirectory = join(PACKAGES_PATH, 'combo', 'grader')
  const binaryPath = join(workingDirectory, 'combo')

  try {
    const build = spawnSync(
      'g++',
      [
        '-O2',
        '-std=c++17',
        '-I',
        graderDirectory,
        '-o',
        binaryPath,
        join(graderDirectory, 'grader.cpp'),
        getBenchmarkSolutionPath(solutionFileName)
      ],
      { encoding: 'utf8', timeout: RUN_TIMEOUT_MS }
    )

    expect(build.status, build.stderr ?? '').toBe(0)

    const run = spawnSync(binaryPath, {
      input: readFileSync(sampleInputPath('combo')),
      encoding: 'utf8',
      timeout: RUN_TIMEOUT_MS
    })

    expect(run.status, run.stderr ?? '').toBe(0)

    return run.stdout.trim()
  } finally {
    rmSync(workingDirectory, { recursive: true, force: true })
  }
}

function expectedTokens(packageDirectory: string): string[] {
  return tokens(readFileSync(sampleOutputPath(packageDirectory), 'utf8'))
}

const pythonSets = BENCHMARK_SOLUTION_SETS.filter(set => set.language === 'python')

describe('shipped reference solutions', () => {
  const python = hasTool('python3')
  const compiler = hasTool('g++')

  describe.each(pythonSets)('$problemSlug', (set: BenchmarkSolutionSet) => {
    const packageDirectory = PACKAGE_DIRECTORIES[set.problemSlug]
    const usesPackageChecker = set.problemSlug === 'rl-nearest-pairs'

    it.skipIf(!python)(
      'the correct solution answers the public sample',
      () => {
        const actual = runPython(
          getBenchmarkSolutionPath(set.correctFileName),
          sampleInputPath(packageDirectory)
        )

        if (usesPackageChecker) {
          expect(runPackageChecker(packageDirectory, actual)).toBe(true)

          return
        }

        expect(tokens(actual)).toEqual(expectedTokens(packageDirectory))
      },
      RUN_TIMEOUT_MS
    )

    it.skipIf(!python)(
      'the wrong solution gets the public sample wrong',
      () => {
        const actual = runPython(
          getBenchmarkSolutionPath(set.wrongFileName),
          sampleInputPath(packageDirectory)
        )

        if (usesPackageChecker) {
          expect(runPackageChecker(packageDirectory, actual)).toBe(false)

          return
        }

        expect(tokens(actual)).not.toEqual(expectedTokens(packageDirectory))
      },
      RUN_TIMEOUT_MS
    )
  })

  it.skipIf(!compiler)(
    'combo: the correct solution is accepted by the grader on the public sample',
    () => {
      expect(runComboGrader('combo-correct.cpp')).toMatch(/^Accepted/u)
    },
    RUN_TIMEOUT_MS
  )

  it.skipIf(!compiler)(
    'combo: the wrong solution is refused by the grader without crashing',
    () => {
      expect(runComboGrader('combo-wrong.cpp')).toMatch(/^Wrong Answer/u)
    },
    RUN_TIMEOUT_MS
  )

  it('says why it skipped when the toolchain is missing', () => {
    if (!python) {
      console.warn('[benchmark] python3 is not installed - the Python solutions were not run.')
    }

    if (!compiler) {
      console.warn('[benchmark] g++ is not installed - the combo solutions were not run.')
    }

    expect(BENCHMARK_SOLUTION_SETS).toHaveLength(4)
  })
})
