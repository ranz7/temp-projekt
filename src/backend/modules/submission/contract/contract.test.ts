import { describe, expect, it } from 'vitest'
import { ClaimJobResponseDTOZ, ResultRequestDTOZ } from './index'

const finalResult = {
  contractVersion: 1,
  submissionId: '0198df77-9122-7000-8000-000000000001',
  claimId: '0198df77-9122-7000-8000-000000000002',
  status: 'accepted',
  score: 1,
  maxScore: 1,
  compileMessage: null,
  maxCpuMs: 12,
  maxMemoryKb: 4096,
  tests: [
    {
      problemTestId: '0198df77-9122-7000-8000-000000000003',
      ordinal: 1,
      verdict: 'passed',
      passed: true,
      pointsAwarded: 1,
      message: null,
      actualOutput: 'YES\n',
      timeMs: 12,
      memoryKb: 4096
    }
  ]
}

describe('checker contract', () => {
  it('parses a valid claim response', () => {
    const result = ClaimJobResponseDTOZ.safeParse({
      contractVersion: 1,
      job: {
        submissionId: '0198df77-9122-7000-8000-000000000001',
        claimId: '0198df77-9122-7000-8000-000000000002',
        problemSlug: 'cf-4-A',
        packageDirectory: 'cf-4-A',
        language: 'python',
        sourceCode: "print('YES')\n",
        timeLimitMs: 1000,
        memoryLimitMb: 64,
        checkerType: 'token',
        checkerPath: null,
        tests: [
          {
            problemTestId: '0198df77-9122-7000-8000-000000000003',
            ordinal: 1,
            visibility: 'public',
            points: 0,
            input: '8\n',
            expectedOutput: 'YES\n'
          },
          {
            problemTestId: '0198df77-9122-7000-8000-000000000004',
            ordinal: 2,
            visibility: 'hidden',
            points: 1,
            inputFile: '002.in',
            outputFile: '002.out'
          }
        ]
      }
    })

    expect(result.success).toBe(true)
  })

  it('rejects a final result without score', () => {
    const { score: _score, ...withoutScore } = finalResult

    expect(ResultRequestDTOZ.safeParse(withoutScore).success).toBe(false)
  })

  it('rejects an unknown test verdict', () => {
    const unknownVerdict = {
      ...finalResult,
      tests: [{ ...finalResult.tests[0], verdict: 'system_error' }]
    }

    expect(ResultRequestDTOZ.safeParse(unknownVerdict).success).toBe(false)
  })

  it('requires contract version 1', () => {
    expect(ResultRequestDTOZ.safeParse({ ...finalResult, contractVersion: 2 }).success).toBe(false)
  })
})
