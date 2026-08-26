import { uuidv7 } from '@backend/database/sql-functions'
import { submission__submission_ } from '@backend/modules/submission/schema'
import { type SubmissionLanguage, task__problem_ } from '@backend/modules/task/schema'
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
  uniqueIndex,
  uuid,
  varchar
} from 'drizzle-orm/pg-core'

/**
 * Where a batch got to. `running` is the only state that still creates
 * submissions; the other three are the ways it can end.
 */
export const BENCHMARK_BATCH_STATUSES = ['running', 'completed', 'stopped', 'failed'] as const
export type BenchmarkBatchStatus = (typeof BENCHMARK_BATCH_STATUSES)[number]

/** The largest batch the panel may ask for. */
export const BENCHMARK_BATCH_MAX_SUBMISSIONS = 500

/** One press of the panel's "send a batch of solutions" button. */
export const benchmark__batch_ = pgTable(
  'benchmark__batch_',
  {
    id: uuid().default(uuidv7).primaryKey().notNull(),
    problem_id_: uuid().notNull(),
    language_: varchar({ length: 32 }).$type<SubmissionLanguage>().notNull(),
    requested_count_: integer().notNull(),
    // How many in a hundred carry the correct solution. The panel's own button
    // sends a mixture; a scaling run sends nothing but correct solutions, because
    // it is measuring how many of those get through.
    correct_percent_: integer().notNull().default(70),
    // How many submissions have actually been created so far. A stopped batch keeps
    // whatever it reached.
    created_count_: integer().notNull().default(0),
    status_: varchar({ length: 16 }).$type<BenchmarkBatchStatus>().notNull().default('running'),
    last_error_: text(),
    started_at_: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    ended_at_: timestamp({ withTimezone: true, mode: 'date' })
  },
  table => [
    foreignKey({
      columns: [table.problem_id_],
      foreignColumns: [task__problem_.id],
      name: 'benchmark__batch__problem__fk_'
    }).onDelete('cascade'),
    index('benchmark__batch__started__idx_').on(table.started_at_),
    // Only one batch runs at a time. Every running row carries the same status, so a
    // unique index over just those rows lets Postgres, not a read-then-write, be the
    // one that says no.
    uniqueIndex('benchmark__batch__single_running__unique_idx_')
      .on(table.status_)
      .where(sql`${table.status_} = 'running'`)
  ]
)

/**
 * Which submissions a batch sent, and whether it sent the correct solution or the
 * deliberately wrong one. The submission itself is an ordinary submission by the
 * `benchmark` account and knows nothing about the batch.
 */
export const benchmark__batch_submission_ = pgTable(
  'benchmark__batch_submission_',
  {
    id: uuid().default(uuidv7).primaryKey().notNull(),
    batch_id_: uuid().notNull(),
    submission_id_: uuid().notNull(),
    /** True when the correct reference solution was sent. */
    expects_accepted_: boolean().notNull(),
    created_at_: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  table => [
    foreignKey({
      columns: [table.batch_id_],
      foreignColumns: [benchmark__batch_.id],
      name: 'benchmark__batch_submission__batch__fk_'
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.submission_id_],
      foreignColumns: [submission__submission_.id],
      name: 'benchmark__batch_submission__submission__fk_'
    }).onDelete('cascade'),
    index('benchmark__batch_submission__batch__idx_').on(table.batch_id_),
    unique('benchmark__batch_submission__submission__unique_').on(table.submission_id_)
  ]
)

/**
 * Where a scaling run got to. `running` is the only state that still starts new
 * steps; the other three are the ways it can end.
 */
export const BENCHMARK_SCALING_STATUSES = ['running', 'completed', 'stopped', 'failed'] as const
export type BenchmarkScalingStatus = (typeof BENCHMARK_SCALING_STATUSES)[number]

/** The most machines a single run will climb to, and the most solutions per step. */
export const BENCHMARK_SCALING_MAX_MACHINES = 32
export const BENCHMARK_SCALING_MAX_PER_STEP = 200

/**
 * One measurement of how the judge scales: the same pile of correct solutions sent
 * again and again, first to one machine, then to two, and so on, so the answer to
 * "what does another machine buy us" is measured rather than guessed.
 */
export const benchmark__scaling_run_ = pgTable(
  'benchmark__scaling_run_',
  {
    id: uuid().default(uuidv7).primaryKey().notNull(),
    problem_id_: uuid().notNull(),
    language_: varchar({ length: 32 }).$type<SubmissionLanguage>().notNull(),
    /** Correct solutions sent in every single step. */
    submissions_per_step_: integer().notNull(),
    /** The last machine count the run will climb to. */
    max_machines_: integer().notNull(),
    status_: varchar({ length: 16 }).$type<BenchmarkScalingStatus>().notNull().default('running'),
    last_error_: text(),
    started_at_: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    ended_at_: timestamp({ withTimezone: true, mode: 'date' })
  },
  table => [
    foreignKey({
      columns: [table.problem_id_],
      foreignColumns: [task__problem_.id],
      name: 'benchmark__scaling_run__problem__fk_'
    }).onDelete('cascade'),
    index('benchmark__scaling_run__started__idx_').on(table.started_at_),
    // One run at a time, decided by Postgres rather than a read-then-write.
    uniqueIndex('benchmark__scaling_run__single_running__unique_idx_')
      .on(table.status_)
      .where(sql`${table.status_} = 'running'`)
  ]
)

/**
 * One rung of a run: this many machines were left working, and this batch of correct
 * solutions was sent to them. How long it took is read from the submissions
 * themselves, so the numbers are the judge's own timestamps rather than a stopwatch
 * held beside it.
 */
export const benchmark__scaling_step_ = pgTable(
  'benchmark__scaling_step_',
  {
    id: uuid().default(uuidv7).primaryKey().notNull(),
    run_id_: uuid().notNull(),
    batch_id_: uuid(),
    machine_count_: integer().notNull(),
    started_at_: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    ended_at_: timestamp({ withTimezone: true, mode: 'date' })
  },
  table => [
    foreignKey({
      columns: [table.run_id_],
      foreignColumns: [benchmark__scaling_run_.id],
      name: 'benchmark__scaling_step__run__fk_'
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.batch_id_],
      foreignColumns: [benchmark__batch_.id],
      name: 'benchmark__scaling_step__batch__fk_'
    }).onDelete('set null'),
    index('benchmark__scaling_step__run__idx_').on(table.run_id_),
    unique('benchmark__scaling_step__rung__unique_').on(table.run_id_, table.machine_count_)
  ]
)
