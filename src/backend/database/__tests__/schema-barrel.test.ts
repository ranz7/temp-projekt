import {
  account__user_,
  CHECKER_TYPES,
  machine__machine_,
  PROBLEM_DIFFICULTIES,
  SUBMISSION_LANGUAGES,
  SUBMISSION_STATUSES,
  submission__submission_,
  submission__test_result_,
  TEST_VERDICTS,
  TEST_VISIBILITIES,
  task__problem_,
  task__problem_test_
} from '@backend/database/schema'
import { getTableName } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

describe('database schema barrel', () => {
  it('re-exports every online judge table', () => {
    const tables = [
      account__user_,
      machine__machine_,
      task__problem_,
      task__problem_test_,
      submission__submission_,
      submission__test_result_
    ]

    expect(tables.map(getTableName)).toEqual([
      'account__user_',
      'machine__machine_',
      'task__problem_',
      'task__problem_test_',
      'submission__submission_',
      'submission__test_result_'
    ])
  })
})

describe('schema value sets', () => {
  it('lists every submission status', () => {
    expect([...SUBMISSION_STATUSES]).toEqual([
      'queued',
      'running',
      'accepted',
      'wrong_answer',
      'time_limit',
      'memory_limit',
      'runtime_error',
      'compilation_error',
      'internal_error'
    ])
  })

  it('lists every per-test verdict', () => {
    expect([...TEST_VERDICTS]).toEqual([
      'passed',
      'wrong_answer',
      'time_limit',
      'memory_limit',
      'runtime_error'
    ])
  })

  it('lists both test visibilities', () => {
    expect([...TEST_VISIBILITIES]).toEqual(['public', 'hidden'])
  })

  it('lists every difficulty', () => {
    expect([...PROBLEM_DIFFICULTIES]).toEqual(['easy', 'medium', 'hard'])
  })

  it('lists the two submission languages', () => {
    expect([...SUBMISSION_LANGUAGES]).toEqual(['python', 'cpp'])
  })

  it('lists every checker type', () => {
    expect([...CHECKER_TYPES]).toEqual(['token', 'custom', 'grader'])
  })
})
