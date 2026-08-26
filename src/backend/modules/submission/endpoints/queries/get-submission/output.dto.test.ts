import { describe, expect, it } from 'vitest'
import { SubmissionTestDTOZ } from './output.dto'

const hiddenEntry = {
  ordinal: 2,
  visibility: 'hidden',
  verdict: 'wrong_answer',
  passed: false,
  pointsAwarded: 0,
  timeMs: 12,
  memoryKb: 4096,
  presses: null
}

const publicEntry = {
  ordinal: 1,
  visibility: 'public',
  verdict: 'passed',
  passed: true,
  pointsAwarded: 0,
  timeMs: 10,
  memoryKb: 2048,
  presses: null,
  input: '8\n',
  expectedOutput: 'YES\n',
  actualOutput: 'YES\n',
  message: null
}

describe('SubmissionTestDTOZ', () => {
  it('accepts a hidden test showing only its number, verdict, time, memory and presses', () => {
    const result = SubmissionTestDTOZ.safeParse(hiddenEntry)

    expect(result.success).toBe(true)
    expect(result.success && Object.keys(result.data).sort()).toEqual([
      'memoryKb',
      'ordinal',
      'passed',
      'pointsAwarded',
      'presses',
      'timeMs',
      'verdict',
      'visibility'
    ])
  })

  it('lets a hidden test carry the press count its grader reported', () => {
    const result = SubmissionTestDTOZ.safeParse({ ...hiddenEntry, presses: 7 })

    expect(result.success).toBe(true)
    expect(result.success && result.data.presses).toBe(7)
  })

  it('still refuses a hidden test that smuggles a leak in beside the press count', () => {
    const result = SubmissionTestDTOZ.safeParse({
      ...hiddenEntry,
      presses: 7,
      actualOutput: 'leaked\n'
    })

    expect(result.success).toBe(false)
  })

  it('refuses a hidden test that carries what the solution printed', () => {
    const result = SubmissionTestDTOZ.safeParse({ ...hiddenEntry, actualOutput: 'leaked\n' })

    expect(result.success).toBe(false)
  })

  it('refuses a hidden test that carries the test data', () => {
    const withInput = SubmissionTestDTOZ.safeParse({ ...hiddenEntry, input: '1000000\n' })
    const withExpectedOutput = SubmissionTestDTOZ.safeParse({
      ...hiddenEntry,
      expectedOutput: 'YES\n'
    })
    const withMessage = SubmissionTestDTOZ.safeParse({
      ...hiddenEntry,
      message: 'differs at line 1'
    })

    expect(withInput.success).toBe(false)
    expect(withExpectedOutput.success).toBe(false)
    expect(withMessage.success).toBe(false)
  })

  it('keeps a sample test complete, data and printed output included', () => {
    const result = SubmissionTestDTOZ.safeParse(publicEntry)

    expect(result.success).toBe(true)
    expect(result.success && result.data.visibility === 'public' && result.data.actualOutput).toBe(
      'YES\n'
    )
  })
})
