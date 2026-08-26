import { CHECKER_CONTRACT_VERSION } from '@backend/modules/machine/contract'
import {
  askMachineToJudge,
  type CheckerCall,
  type CheckerReply,
  resetCheckerTransport,
  setCheckerTransport
} from '@backend/modules/machine/internal-functions/checker-client'
import { afterEach, describe, expect, it } from 'vitest'

const machine = { id: 'm1', name: 'unit-checker', localPort: 19_999 }

afterEach(() => {
  resetCheckerTransport()
})

describe('askMachineToJudge', () => {
  it('sends only the submission id, the problem, the language and the source - nothing a hidden test would carry', async () => {
    let seen: CheckerCall | null = null

    setCheckerTransport(async (call: CheckerCall): Promise<CheckerReply> => {
      seen = call

      return {
        status: 202,
        body: { contractVersion: CHECKER_CONTRACT_VERSION, jobId: 'job-1' }
      }
    })

    await askMachineToJudge(machine, {
      submissionId: '0198df77-9122-7000-8000-000000000001',
      problemSlug: 'combo',
      packageDirectory: 'combo',
      language: 'cpp',
      sourceCode: 'int main() {}'
    })

    if (seen === null) throw new Error('Expected a call to be made.')

    const call = seen as CheckerCall
    const body = call.body as Record<string, unknown>

    expect(call.path).toBe('/judge')
    // Exactly the fields the contract names - no test input, no expected output, no
    // file name that would let a hidden test's content or shape leave this app.
    expect(Object.keys(body).sort()).toEqual(
      [
        'contractVersion',
        'submissionId',
        'problemSlug',
        'packageDirectory',
        'language',
        'sourceCode'
      ].sort()
    )
    expect(body.packageDirectory).toBe('combo')
    expect(body.sourceCode).toBe('int main() {}')
  })

  it('carries the shared key on /judge, unlike the key-free /health', async () => {
    let seenKey: string | null | undefined

    setCheckerTransport(async (call: CheckerCall): Promise<CheckerReply> => {
      seenKey = call.serviceKey

      return {
        status: 202,
        body: { contractVersion: CHECKER_CONTRACT_VERSION, jobId: 'job-1' }
      }
    })

    process.env.SERVICE_KEY = 'unit-test-key'

    await askMachineToJudge(machine, {
      submissionId: '0198df77-9122-7000-8000-000000000002',
      problemSlug: 'combo',
      packageDirectory: 'combo',
      language: 'cpp',
      sourceCode: 'int main() {}'
    })

    expect(seenKey).toBe('unit-test-key')
  })
})
