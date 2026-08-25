import { describe, expect, it } from 'vitest'
import { CheckerHealthDTOZ, CheckerJobStatusDTOZ, CheckerJudgeAcceptedDTOZ } from './index'

const doneJob = {
  contractVersion: 2,
  status: 'done',
  result: {
    status: 'accepted',
    score: 1,
    maxScore: 1,
    compileMessage: null,
    maxCpuMs: 12,
    maxMemoryKb: 4096,
    tests: [
      {
        ordinal: 1,
        visibility: 'hidden',
        verdict: 'passed',
        passed: true,
        pointsAwarded: 1,
        message: null,
        actualOutput: 'YES\n',
        timeMs: 12,
        memoryKb: 4096,
        name: '001',
        presses: null
      }
    ]
  }
}

describe('checker contract', () => {
  it('reads what a machine says about itself', () => {
    const health = CheckerHealthDTOZ.safeParse({
      contractVersion: 2,
      ok: true,
      busy: 1,
      capacity: 2,
      problems: ['combo', 'minimizing-coins'],
      version: '3240be9'
    })

    expect(health.success).toBe(true)
  })

  it('reads a finished job, keeps the press count and drops the file name', () => {
    const parsed = CheckerJobStatusDTOZ.safeParse({
      ...doneJob,
      result: {
        ...doneJob.result,
        tests: [{ ...doneJob.result.tests[0], presses: 7 }]
      }
    })

    expect(parsed.success).toBe(true)

    if (!parsed.success || parsed.data.status !== 'done') throw new Error('Expected a done job.')

    expect(parsed.data.result.tests[0].presses).toBe(7)
    expect(Object.keys(parsed.data.result.tests[0]).sort()).toEqual([
      'actualOutput',
      'memoryKb',
      'message',
      'ordinal',
      'passed',
      'pointsAwarded',
      'presses',
      'timeMs',
      'verdict',
      'visibility'
    ])
  })

  it('reads a test of an ordinary problem, which counts no presses', () => {
    const parsed = CheckerJobStatusDTOZ.safeParse(doneJob)

    expect(parsed.success).toBe(true)

    if (!parsed.success || parsed.data.status !== 'done') throw new Error('Expected a done job.')

    expect(parsed.data.result.tests[0].presses).toBeNull()
  })

  it('reads a job that is still running', () => {
    expect(CheckerJobStatusDTOZ.safeParse({ contractVersion: 2, status: 'running' }).success).toBe(
      true
    )
  })

  it('refuses a verdict this app does not know', () => {
    const unknown = {
      ...doneJob,
      result: {
        ...doneJob.result,
        tests: [{ ...doneJob.result.tests[0], verdict: 'system_error' }]
      }
    }

    expect(CheckerJobStatusDTOZ.safeParse(unknown).success).toBe(false)
  })

  it('speaks contract version 2 only', () => {
    expect(CheckerJobStatusDTOZ.safeParse({ ...doneJob, contractVersion: 1 }).success).toBe(false)
    expect(CheckerJudgeAcceptedDTOZ.safeParse({ contractVersion: 1, jobId: 'x' }).success).toBe(
      false
    )
  })
})
