import { uuidv7 } from '@backend/database/sql-functions'
import { account__user_ } from '@backend/modules/account/schema'
import { machine__machine_ } from '@backend/modules/machine/schema'
import {
  type SubmissionLanguage,
  type TestVisibility,
  task__problem_,
  task__problem_test_
} from '@backend/modules/task/schema'
import { sql } from 'drizzle-orm'
import {
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar
} from 'drizzle-orm/pg-core'

/** Lifecycle of a submission. `queued` and `running` are the only non-final states. */
export const SUBMISSION_STATUSES = [
  'queued',
  'running',
  'accepted',
  'wrong_answer',
  'time_limit',
  'memory_limit',
  'runtime_error',
  'compilation_error',
  'internal_error'
] as const
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number]

/** Statuses a submission can still move away from. */
export const PENDING_SUBMISSION_STATUSES = ['queued', 'running'] as const

/** Outcome of running one test of a submission. */
export const TEST_VERDICTS = [
  'passed',
  'wrong_answer',
  'time_limit',
  'memory_limit',
  'runtime_error'
] as const
export type TestVerdict = (typeof TEST_VERDICTS)[number]

export const submission__submission_ = pgTable(
  'submission__submission_',
  {
    id: uuid().default(uuidv7).primaryKey().notNull(),
    problem_id_: uuid().notNull(),
    user_id_: uuid().notNull(),
    language_: varchar({ length: 32 }).$type<SubmissionLanguage>().notNull(),
    source_code_: text().notNull(),
    status_: varchar({ length: 32 }).$type<SubmissionStatus>().notNull().default('queued'),
    score_: integer(),
    max_score_: integer(),
    compile_message_: text(),
    judge_message_: text(),
    max_cpu_ms_: integer(),
    max_memory_kb_: integer(),
    created_at_: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    judged_at_: timestamp({ withTimezone: true, mode: 'date' }),
    lease_expires_at_: timestamp({ withTimezone: true, mode: 'date' }),
    judge_claim_id_: uuid(),
    judge_attempts_: integer().notNull().default(0),
    // Which machine is judging this submission, and what that machine calls the job.
    machine_id_: uuid(),
    checker_job_id_: varchar({ length: 64 })
  },
  table => [
    foreignKey({
      columns: [table.problem_id_],
      foreignColumns: [task__problem_.id],
      name: 'submission__submission__problem__fk_'
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.user_id_],
      foreignColumns: [account__user_.id],
      name: 'submission__submission__user__fk_'
    }).onDelete('cascade'),
    // A machine can be retired without losing the submissions it judged.
    foreignKey({
      columns: [table.machine_id_],
      foreignColumns: [machine__machine_.id],
      name: 'submission__submission__machine__fk_'
    }).onDelete('set null'),
    index('submission__submission__problem__idx_').on(table.problem_id_),
    index('submission__submission__user__idx_').on(table.user_id_),
    index('submission__submission__machine__idx_').on(table.machine_id_),
    index('submission__submission__queued__idx_')
      .on(table.problem_id_, table.created_at_)
      .where(sql`${table.status_} = 'queued'`)
  ]
)

export const submission__test_result_ = pgTable(
  'submission__test_result_',
  {
    id: uuid().default(uuidv7).primaryKey().notNull(),
    submission_id_: uuid().notNull(),
    problem_test_id_: uuid().notNull(),
    ordinal_: integer().notNull(),
    visibility_: varchar({ length: 16 }).$type<TestVisibility>().notNull(),
    verdict_: varchar({ length: 32 }).$type<TestVerdict>().notNull(),
    passed_: boolean().notNull(),
    points_awarded_: integer().notNull().default(0),
    message_: text(),
    actual_output_: text(),
    time_ms_: integer(),
    memory_kb_: integer(),
    // How many button presses an interactive problem's grader counted. Null for every
    // ordinary problem, where nothing presses anything.
    presses_: integer()
  },
  table => [
    foreignKey({
      columns: [table.submission_id_],
      foreignColumns: [submission__submission_.id],
      name: 'submission__test_result__submission__fk_'
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.problem_test_id_],
      foreignColumns: [task__problem_test_.id],
      name: 'submission__test_result__problem_test__fk_'
    }).onDelete('cascade'),
    index('submission__test_result__submission__idx_').on(table.submission_id_),
    index('submission__test_result__problem_test__idx_').on(table.problem_test_id_),
    unique('submission__test_result__submission_problem_test__unique_').on(
      table.submission_id_,
      table.problem_test_id_
    )
  ]
)
